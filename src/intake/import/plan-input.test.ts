import { describe, expect, it } from 'vitest'
import { dayNumber } from '../../engine/calendar'
import { plan } from '../../engine/index'
import type { ImportedTechnician } from '../map/apply'
import type { SiteProfile } from '../site/site'
import { starterSite } from '../site/starter'
import type { StoredCase } from './merge'
import { toPlanInput } from './plan-input'

const site: SiteProfile = {
  ...starterSite(),
  places: [
    { name: 'North Town', latitude: 20.1, longitude: 30.05 },
    { name: 'South Bay', latitude: 19.95, longitude: 30.1 },
  ],
}
const stored = (id: string, over: Partial<StoredCase> = {}): StoredCase => ({
  caseId: id, workTypeName: 'Service', place: 'North Town', state: 'active', reportedAt: '2026-10-10', overrides: {},
  firstImported: '2026-10-13', lastImported: '2026-10-13', ...over,
})
const tech = (name: string, over: Partial<ImportedTechnician> = {}): ImportedTechnician => ({ name, skills: ['Service'], active: true, ...over })
const OPTIONS = { planStart: '2026-10-13', importDate: '2026-10-13' }

describe('toPlanInput: which cases go in', () => {
  it('keeps only active cases that have a known work type and place', () => {
    const cases = [
      stored('1'), stored('2', { state: 'hold' }), stored('3', { state: 'review' }), stored('4', { state: 'ignored' }),
      stored('5', { state: 'done' }), stored('6', { state: 'closed' }), stored('7', { place: undefined }),
      stored('8', { workTypeName: undefined }), stored('9', { place: 'Elsewhere' }), stored('10', { workTypeName: 'Plumbing' }),
    ]
    expect(toPlanInput(site, cases, [tech('T')], OPTIONS).caseIds).toEqual(['1'])
  })
  it('sorts numeric identifiers by number, then text identifiers by text', () => {
    const cases = ['10', 'B-2', '9', 'A-1', '100', '09'].map((id) => stored(id))
    expect(toPlanInput(site, cases, [tech('T')], OPTIONS).caseIds).toEqual(['09', '9', '10', '100', 'A-1', 'B-2'])
  })
})

describe('toPlanInput: mapping', () => {
  const t = [tech('T1'), tech('T2', { skills: ['Installation', 'Nothing'] })]
  it('maps work types, places, dates, priority, due day, duration and earliest day to indexes and day numbers', () => {
    const c = stored('1', {
      workTypeName: 'Breakdown', place: 'South Bay', reportedAt: '2026-10-01', priorityLevel: 'Escalated', dueAt: '2026-10-20',
      durationMin: 45, earliestDate: '2026-10-14',
    })
    expect(toPlanInput(site, [c], t, OPTIONS).input.cases[0]).toEqual({
      id: '1', workType: 2, place: 1, reportedDay: dayNumber('2026-10-01'), priority: 1, dueDay: dayNumber('2026-10-20'),
      serviceMin: 45, earliestDay: dayNumber('2026-10-14'),
    })
  })
  it('uses the import date when a case has no reported date', () => {
    const c = stored('1', { reportedAt: undefined })
    expect(toPlanInput(site, [c], t, { ...OPTIONS, importDate: '2026-10-12' }).input.cases[0].reportedDay).toBe(dayNumber('2026-10-12'))
  })
  it('pins the assigned technician only when the site keeps assignments; the user\'s own pin always counts', () => {
    const c = stored('1', { technician: ' t2 ' })
    expect(toPlanInput(site, [c], t, OPTIONS).input.cases[0].pinnedTech).toBe(1)
    expect(toPlanInput({ ...site, keepAssignedTechnician: false }, [c], t, OPTIONS).input.cases[0].pinnedTech).toBeUndefined()
    const own = stored('1', { technician: 'T2', overrides: { technician: 'T1', date: '2026-10-15' } })
    const out = toPlanInput({ ...site, keepAssignedTechnician: false }, [own], t, OPTIONS).input.cases[0]
    expect(out.pinnedTech).toBe(0)
    expect(out.earliestDay).toBe(dayNumber('2026-10-15'))
    expect(toPlanInput(site, [stored('1', { technician: 'Nobody' })], t, OPTIONS).input.cases[0].pinnedTech).toBeUndefined()
  })
  it('maps technicians: skills to indexes (unknown dropped), leave, places, hours', () => {
    const techs = [
      tech('T1', { skills: ['Service', 'service', 'Plumbing'], leaveFrom: '2026-10-20', leaveTo: '2026-10-22', startPlace: 'South Bay', endPlace: 'Nowhere', shiftStart: 510, shiftHours: 8, breakMin: 45 }),
      tech('T2', { active: false, shiftHours: 7 }),
    ]
    const out = toPlanInput(site, [stored('1')], techs, OPTIONS).input.technicians
    expect(out[0]).toEqual({
      name: 'T1', skills: [1], active: true, leaveFrom: dayNumber('2026-10-20'), leaveTo: dayNumber('2026-10-22'),
      startPlace: 1, dayStartMin: 510, usableMin: 8 * 60 - 45, breakMin: 45,
    })
    expect(out[1]).toEqual({ name: 'T2', skills: [1], active: false, usableMin: 7 * 60 - 60 })
  })
  it('copies settings, adds the start day, holidays and levels, and lists places and work types', () => {
    const { input } = toPlanInput(site, [stored('1')], [tech('T')], { ...OPTIONS, holidays: ['2026-10-15'] })
    expect(input.settings).toMatchObject({ speedKmh: 30, usableMin: 480, startDay: dayNumber('2026-10-13'), holidays: [dayNumber('2026-10-15')] })
    expect(input.settings.priorityLevels).toEqual([{ name: 'Normal', weight: 0 }, { name: 'Escalated', weight: 100000 }])
    expect(input.places).toEqual([{ name: 'North Town', lat: 20.1, lon: 30.05 }, { name: 'South Bay', lat: 19.95, lon: 30.1 }])
    expect(input.workTypes.map((w) => w.name)).toEqual(['Installation', 'Service', 'Breakdown'])
  })
  it('does not share objects with the site', () => {
    const { input } = toPlanInput(site, [stored('1')], [tech('T')], OPTIONS)
    input.workTypes[0].name = 'Changed'
    input.settings.priorityLevels![0].name = 'Changed'
    expect(site.workTypes[0].name).toBe('Installation')
    expect(site.priorityLevels[0].name).toBe('Normal')
  })
})

describe('toPlanInput: the engine accepts the result', () => {
  it('plans imported cases', () => {
    const cases = ['1', '2', '3'].map((id) => stored(id, { place: id === '3' ? 'South Bay' : 'North Town' }))
    const { input, caseIds } = toPlanInput(site, cases, [tech('T1'), tech('T2')], OPTIONS)
    const result = plan(input)
    expect(result.scheduled.map((s) => s.id).sort()).toEqual(caseIds)
    expect(result.unscheduled).toEqual([])
  })
})
