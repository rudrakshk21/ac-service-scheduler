import { describe, expect, it } from 'vitest'
import { plan } from '../../engine/index'
import type { StoredCase } from '../../intake/import/merge'
import { emptyWorkspace, type Workspace } from '../../workspace/workspace'
import type { PlanInput } from '../../engine/types'
import { generateInput } from '../../engine/testing/generate'
import { baseAdvice, nothingPlannedHint, prepare, sizeNotice, startDate, TESTED_SIZE } from './planData'

describe('startDate', () => {
  it('is today when today is a working day', () => {
    expect(startDate('2026-10-13', [6], [])).toBe('2026-10-13') // a Tuesday
  })
  it('rolls a rest day to the next working day', () => {
    expect(startDate('2026-10-18', [6], [])).toBe('2026-10-19') // Sunday to Monday
    expect(startDate('2026-10-17', [5, 6], [])).toBe('2026-10-19') // Saturday and Sunday off
  })
  it('skips holidays, also after a rest day', () => {
    expect(startDate('2026-10-18', [6], ['2026-10-19'])).toBe('2026-10-20')
    expect(startDate('2026-10-13', [6], ['2026-10-13', '2026-10-14'])).toBe('2026-10-15')
  })
  it('stops looking when every day is off', () => {
    expect(startDate('2026-10-13', [0, 1, 2, 3, 4, 5, 6], [])).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

const stored = (id: string, over: Partial<StoredCase> = {}): StoredCase => ({
  caseId: id, workTypeName: 'Service', place: 'North', state: 'active', reportedAt: '2026-10-10', overrides: {},
  firstImported: '2026-10-13', lastImported: '2026-10-13', ...over,
})
function ready(): Workspace {
  const w = emptyWorkspace()
  return {
    ...w,
    site: { ...w.site, places: [{ name: 'North', latitude: 20.1, longitude: 30.05 }, { name: 'South', latitude: 19.95, longitude: 30.1 }] },
    technicians: [{ name: 'Ann', skills: ['Service'], active: true }, { name: 'Bo', skills: ['Service'], active: true }],
    cases: [stored('10'), stored('9'), stored('100', { place: 'South' })],
  }
}
const TODAY = '2026-10-13'

describe('prepare: when it cannot plan yet', () => {
  it('asks for technicians first, then cases', () => {
    const noTech = prepare({ ...ready(), technicians: [] }, TODAY)
    expect(noTech).toMatchObject({ ok: false, title: 'Import your technicians', action: { label: 'Import technicians', href: '#/import' } })
    const noCases = prepare({ ...ready(), cases: [] }, TODAY)
    expect(noCases).toMatchObject({ ok: false, title: 'Import your cases', action: { href: '#/import' } })
  })
  it('explains when no case is ready, with the counts', () => {
    const w = { ...ready(), cases: [stored('1', { state: 'hold' }), stored('2', { state: 'review' }), stored('3', { state: 'done' })] }
    const p = prepare(w, TODAY)
    expect(p).toMatchObject({ ok: false, title: 'Nothing is ready to plan', action: { href: '#/data' } })
    expect(p.ok ? '' : p.text).toBe('1 on hold, 1 in review, 0 ignored, 1 done, 0 closed. Only cases that are ready to plan are planned.')
  })
  it('asks to switch a technician on when all are off', () => {
    const w = { ...ready(), technicians: ready().technicians.map((t) => ({ ...t, active: false })) }
    expect(prepare(w, TODAY)).toMatchObject({ ok: false, title: 'Switch a technician on', action: { href: '#/setup' } })
  })
  it('says so when the ready cases have no known place or work type', () => {
    const w = { ...ready(), cases: [stored('1', { place: undefined }), stored('2', { workTypeName: 'Plumbing' })] }
    expect(prepare(w, TODAY)).toMatchObject({ ok: false, title: 'No case can be planned yet' })
  })
})

describe('prepare: when it can', () => {
  it('builds an input the engine accepts, with cases in numeric order and the counts of what is left out', () => {
    const w = { ...ready(), cases: [...ready().cases, stored('1', { state: 'hold' }), stored('2', { state: 'review' }), stored('3', { place: undefined })] }
    const p = prepare(w, TODAY)
    if (!p.ok) throw new Error(p.text)
    expect(p.caseIds).toEqual(['9', '10', '100'])
    expect(p.left).toEqual({ hold: 1, review: 1, noPlace: 1 })
    expect(p.planStart).toBe('2026-10-13')
    expect(p.input.technicians.map((t) => t.name)).toEqual(['Ann', 'Bo'])
    const result = plan(p.input)
    expect(result.scheduled.map((s) => s.id).sort()).toEqual(['10', '100', '9'])
  })
  it('starts on the next working day and passes the holidays on', () => {
    const w = { ...ready(), holidays: ['2026-10-14'] }
    const p = prepare(w, '2026-10-18') // Sunday
    if (!p.ok) throw new Error(p.text)
    expect(p.planStart).toBe('2026-10-19')
    expect(p.input.settings.holidays).toHaveLength(1)
  })
})

describe('baseAdvice', () => {
  /** Cases far from the starting base (20, 30), as when a centre in another country imports its first files. */
  function faraway(): Workspace {
    const w = ready()
    return {
      ...w,
      site: { ...w.site, places: [{ name: 'North', latitude: 12.9, longitude: 77.5 }, { name: 'South', latitude: 13.1, longitude: 77.7 }] },
    }
  }
  it('says nothing when a case is within a day of the base', () => {
    expect(baseAdvice(ready())).toBeNull()
  })
  it('suggests the middle of the cases when none can be reached from the base in a day, and how far away it is', () => {
    const a = baseAdvice(faraway())
    expect(a).toEqual({ lat: 13, lon: 77.6, nearestKm: Math.round(a?.nearestKm ?? 0) })
    expect(a?.nearestKm).toBeGreaterThan(5000)
  })
  it('looks only at cases that are ready to plan', () => {
    const w = faraway()
    expect(baseAdvice({ ...w, cases: [stored('1', { place: 'North', state: 'hold' })] })).toBeNull()
  })
  it('uses only the places the ready cases are in', () => {
    const w = faraway()
    const a = baseAdvice({ ...w, cases: [stored('1', { place: 'North' })] })
    expect(a).toMatchObject({ lat: 12.9, lon: 77.5 })
  })
  it('says nothing when every active technician starts and ends the day at a place of their own', () => {
    const w = faraway()
    const own = w.technicians.map((t) => ({ ...t, startPlace: 'North', endPlace: 'North' }))
    expect(baseAdvice({ ...w, technicians: own })).toBeNull()
    expect(baseAdvice({ ...w, technicians: [{ ...own[0], endPlace: undefined }, own[1]] })).not.toBeNull()
  })
  it('says nothing when there is no case with a place', () => {
    expect(baseAdvice({ ...faraway(), cases: [stored('1', { place: undefined })] })).toBeNull()
  })
})

describe('nothingPlannedHint', () => {
  const inputFor = (w: Workspace) => {
    const p = prepare(w, TODAY)
    if (!p.ok) throw new Error(p.text)
    return p.input
  }
  it('points at missing skills when no active technician has any, which is why nothing is planned', () => {
    const input = inputFor({ ...ready(), technicians: ready().technicians.map((t) => ({ ...t, skills: [] })) })
    const result = plan(input)
    expect(result.scheduled).toHaveLength(0)
    expect(result.unscheduled[0].reason).toBe('No active technician has this skill')
    expect(nothingPlannedHint(input)).toBe(
      'None of the active technicians has a skill matched, so nobody can take these cases. Give them skills in Set-up, or match the skill words when you import the technicians again.',
    )
  })
  it('ignores switched-off technicians when looking for skills', () => {
    const techs = [{ name: 'Ann', skills: [], active: true }, { name: 'Bo', skills: ['Service'], active: false }]
    expect(nothingPlannedHint(inputFor({ ...ready(), technicians: techs }))).toMatch(/^None of the active technicians has a skill matched/)
  })
  it('otherwise sends the reader to the reasons', () => {
    expect(nothingPlannedHint(inputFor(ready()))).toBe('Nothing could be planned. The reasons are listed below.')
  })
})

describe('sizeNotice (NFR-4: the app states its limits for a larger data set)', () => {
  const sized = (cases: number, technicians: number, horizonDays = 30): PlanInput => {
    const input = generateInput(5, 10, technicians, cases)
    input.technicians.forEach((t) => { t.active = true })
    input.settings.horizonDays = horizonDays
    return input
  }

  it('says nothing up to the size the app was tested with: 2,000 cases, 100 technicians, 30 days', () => {
    expect(sizeNotice(sized(2000, 100, 30))).toBeNull()
    expect(sizeNotice(sized(10, 3))).toBeNull()
  })
  it('gives the numbers when there are more cases, more technicians or a longer horizon', () => {
    expect(sizeNotice(sized(2001, 100))).toEqual({ cases: 2001, technicians: 100, days: 30 })
    expect(sizeNotice(sized(2000, 101))).toEqual({ cases: 2000, technicians: 101, days: 30 })
    expect(sizeNotice(sized(2000, 100, 31))).toEqual({ cases: 2000, technicians: 100, days: 31 })
  })
  it('counts only the technicians who are working', () => {
    const input = sized(100, 120)
    input.technicians.slice(0, 30).forEach((t) => { t.active = false })
    expect(sizeNotice(input)).toBeNull() // 90 active
  })
  it('publishes the tested size, so the message and the measurements say the same', () => {
    expect(TESTED_SIZE).toEqual({ cases: 2000, technicians: 100, days: 30 })
  })
})
