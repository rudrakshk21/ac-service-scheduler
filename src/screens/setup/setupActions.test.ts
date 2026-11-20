import { describe, expect, it } from 'vitest'
import type { StoredCase } from '../../intake/import/merge'
import type { MappingProfile } from '../../intake/map/profile'
import { emptyWorkspace, type Workspace } from '../../workspace/workspace'
import * as a from './setupActions'

const stored = (id: string, over: Partial<StoredCase> = {}): StoredCase => ({
  caseId: id, workTypeName: 'Service', place: 'North Town', state: 'active', overrides: {}, firstImported: '2026-10-13', lastImported: '2026-10-13', ...over,
})
const profile: MappingProfile = {
  profileVersion: 1, name: 'p', kind: 'cases', fingerprint: 'f', formats: {}, singleWorkType: 'Service', columns: {},
  valueMaps: { workType: { repair: 'Service', 'new unit': 'Installation' }, status: {}, priority: { p1: 'Escalated' }, skill: { 'ac fitting': 'Installation', 'split service': 'Service' } },
}
function fixture(): Workspace {
  const w = emptyWorkspace()
  return {
    ...w,
    site: {
      ...w.site,
      places: [{ name: 'North Town', latitude: 20.1, longitude: 30.05, postalCode: '111' }, { name: 'South Bay', latitude: 19.95, longitude: 30.1 }],
      aliases: { 'n town': 'North Town' },
    },
    technicians: [
      { name: 'Ann', skills: ['Service'], active: true, startPlace: 'North Town', endPlace: 'North Town' },
      { name: 'Bo', skills: ['Installation'], active: true },
    ],
    cases: [stored('1', { priorityLevel: 'Escalated' }), stored('2', { workTypeName: 'Installation', place: 'South Bay' })],
    profiles: [profile],
  }
}
const good = (o: a.Outcome): Workspace => {
  if (!o.ok) throw new Error(`expected success, got: ${o.error}`)
  return o.workspace
}
const bad = (o: a.Outcome): string => {
  if (o.ok) throw new Error('expected an error')
  return o.error
}

describe('purity', () => {
  it('leaves its input untouched and returns the same workspace on an error', () => {
    const w = fixture()
    const frozen = JSON.stringify(w)
    good(a.renamePlace(w, 'North Town', 'Northville'))
    good(a.addSkill(w, 'Plumbing'))
    bad(a.removeWorkType(w, 'Service'))
    expect(JSON.stringify(w)).toBe(frozen)
  })
})

describe('the centre and its rules', () => {
  it('sets the name and the base', () => {
    expect(good(a.setSiteName(fixture(), '  My centre ')).site.name).toBe('My centre')
    expect(bad(a.setSiteName(fixture(), '   '))).toBe('Give the centre a name.')
    const w = good(a.setBase(fixture(), 8.5, 76.9))
    expect([w.site.settings.baseLat, w.site.settings.baseLon]).toEqual([8.5, 76.9])
    expect(bad(a.setBase(fixture(), 95, 0))).toBe('Latitude must be between -90 and 90.')
    expect(bad(a.setBase(fixture(), 0, 200))).toBe('Longitude must be between -180 and 180.')
    expect(bad(a.setBase(fixture(), Number.NaN, 0))).toContain('Latitude')
  })
  it('changes rule values only when every value is valid', () => {
    const w = good(a.setSettings(fixture(), { speedKmh: 40, restWeekdays: [5, 6], dueWeight: 10, horizonDays: 14 }))
    expect(w.site.settings).toMatchObject({ speedKmh: 40, restWeekdays: [5, 6], dueWeight: 10, horizonDays: 14 })
    expect(bad(a.setSettings(fixture(), { speedKmh: 0 }))).toBe('Speed must be more than 0.')
    expect(bad(a.setSettings(fixture(), { roadFactor: -1 }))).toBe('The road factor must be more than 0.')
    expect(bad(a.setSettings(fixture(), { breakMin: -5 }))).toBe('The break must be 0 or more.')
    expect(bad(a.setSettings(fixture(), { horizonDays: 2.5 }))).toBe('Planning days ahead must be a whole number.')
    expect(bad(a.setSettings(fixture(), { restWeekdays: [7] }))).toBe('Rest days must be days of the week.')
    expect(bad(a.setSettings(fixture(), { maxKm: Number.NaN }))).toBe('The longest distance must be a number.')
    expect(bad(a.setSettings(fixture(), { baseLat: 91 }))).toBe('Latitude must be between -90 and 90.')
    expect(bad(a.setSettings(fixture(), { baseLon: -181 }))).toBe('Longitude must be between -180 and 180.')
    expect(bad(a.setSettings(fixture(), { speedKmh: 40, usableMin: -1 }))).toContain('Working minutes')
    expect(good(a.setSettings(fixture(), { dueWeight: undefined })).site.settings.speedKmh).toBe(30)
  })
})

describe('work types', () => {
  it('adds one with a required skill, and refuses bad input', () => {
    const w = good(a.addWorkType(fixture(), { name: ' Cleaning ', serviceMin: 45, dailyCeiling: 6, skill: 'service' }))
    expect(w.site.workTypes[3]).toEqual({ name: 'Cleaning', serviceMin: 45, dailyCeiling: 6, requiredSkill: 1 })
    expect(bad(a.addWorkType(fixture(), { name: '', serviceMin: 1, dailyCeiling: 1, skill: 'Service' }))).toBe('Write a name.')
    expect(bad(a.addWorkType(fixture(), { name: 'service', serviceMin: 1, dailyCeiling: 1, skill: 'Service' }))).toBe('That name is already used.')
    expect(bad(a.addWorkType(fixture(), { name: 'X', serviceMin: 1, dailyCeiling: 1, skill: 'Plumbing' }))).toBe('Choose a skill that exists.')
    expect(bad(a.addWorkType(fixture(), { name: 'X', serviceMin: -1, dailyCeiling: 1, skill: 'Service' }))).toBe('Visit minutes must be 0 or more.')
    expect(bad(a.addWorkType(fixture(), { name: 'X', serviceMin: 1, dailyCeiling: 0, skill: 'Service' }))).toBe('The daily limit must be more than 0.')
  })
  it('updates minutes, limit and skill', () => {
    const w = good(a.updateWorkType(fixture(), 'Service', { serviceMin: 90, dailyCeiling: 4, skill: 'Breakdown' }))
    expect(w.site.workTypes[1]).toEqual({ name: 'Service', serviceMin: 90, dailyCeiling: 4, requiredSkill: 2 })
    expect(bad(a.updateWorkType(fixture(), 'Nope', {}))).toBe('That work type does not exist.')
    expect(bad(a.updateWorkType(fixture(), 'Service', { serviceMin: -1 }))).toBe('Visit minutes must be 0 or more.')
    expect(bad(a.updateWorkType(fixture(), 'Service', { dailyCeiling: 0 }))).toBe('The daily limit must be more than 0.')
    expect(bad(a.updateWorkType(fixture(), 'Service', { skill: 'Nope' }))).toBe('Choose a skill that exists.')
  })
  it('renames everywhere the old name was stored', () => {
    const w = good(a.renameWorkType(fixture(), 'Service', 'Repair work'))
    expect(w.site.workTypes[1].name).toBe('Repair work')
    expect(w.cases[0].workTypeName).toBe('Repair work')
    expect(w.cases[1].workTypeName).toBe('Installation')
    expect(w.profiles[0].valueMaps.workType).toEqual({ repair: 'Repair work', 'new unit': 'Installation' })
    expect(w.profiles[0].singleWorkType).toBe('Repair work')
    expect(good(a.renameWorkType(fixture(), 'Service', 'SERVICE')).site.workTypes[1].name).toBe('SERVICE')
    expect(bad(a.renameWorkType(fixture(), 'Service', 'breakdown'))).toBe('That name is already used.')
    expect(bad(a.renameWorkType(fixture(), 'Service', ' '))).toBe('Write a name.')
    expect(bad(a.renameWorkType(fixture(), 'Nope', 'X'))).toBe('That work type does not exist.')
  })
  it('refuses to remove a work type that cases use, or the last one, and tidies mappings when it can', () => {
    expect(bad(a.removeWorkType(fixture(), 'Service'))).toBe('1 case uses this work type.')
    const w = { ...fixture(), cases: [] }
    const out = good(a.removeWorkType(w, 'Service'))
    expect(out.site.workTypes.map((x) => x.name)).toEqual(['Installation', 'Breakdown'])
    expect(out.profiles[0].valueMaps.workType).toEqual({ 'new unit': 'Installation' })
    expect(out.profiles[0].singleWorkType).toBeUndefined()
    const one = { ...w, site: { ...w.site, workTypes: [w.site.workTypes[0]] } }
    expect(bad(a.removeWorkType(one, 'Installation'))).toBe('A site needs at least one work type.')
    expect(bad(a.removeWorkType(fixture(), 'Nope'))).toBe('That work type does not exist.')
  })
})

describe('skills', () => {
  it('adds and renames, following technicians and saved mappings', () => {
    expect(good(a.addSkill(fixture(), ' Plumbing ')).site.skills).toEqual(['Installation', 'Service', 'Breakdown', 'Plumbing'])
    expect(bad(a.addSkill(fixture(), 'service'))).toBe('That name is already used.')
    expect(bad(a.addSkill(fixture(), ''))).toBe('Write a name.')
    const w = good(a.renameSkill(fixture(), 'Service', 'Maintenance'))
    expect(w.site.skills[1]).toBe('Maintenance')
    expect(w.technicians[0].skills).toEqual(['Maintenance'])
    expect(w.profiles[0].valueMaps.skill['split service']).toBe('Maintenance')
    expect(bad(a.renameSkill(fixture(), 'Service', 'installation'))).toBe('That name is already used.')
    expect(bad(a.renameSkill(fixture(), 'Nope', 'X'))).toBe('That skill does not exist.')
    expect(bad(a.renameSkill(fixture(), 'Service', ''))).toBe('Write a name.')
  })
  it('refuses to remove a skill that is needed, held, or the last one; re-indexes work types otherwise', () => {
    expect(bad(a.removeSkill(fixture(), 'Service'))).toBe('A work type needs this skill.')
    const w = good(a.addSkill(fixture(), 'Plumbing'))
    const held = { ...w, technicians: [{ name: 'T', skills: ['Plumbing'], active: true }] }
    expect(bad(a.removeSkill(held, 'Plumbing'))).toBe('1 technician has this skill.')
    expect(good(a.removeSkill(w, 'Plumbing')).site.skills).toEqual(['Installation', 'Service', 'Breakdown'])
    // remove the first skill after freeing it: work types above it move down by one
    const freed = { ...w, site: { ...w.site, workTypes: w.site.workTypes.map((x) => (x.requiredSkill === 0 ? { ...x, requiredSkill: 3 } : x)) }, technicians: [] as Workspace['technicians'] }
    const out = good(a.removeSkill(freed, 'Installation'))
    expect(out.site.skills).toEqual(['Service', 'Breakdown', 'Plumbing'])
    expect(out.site.workTypes.map((x) => x.requiredSkill)).toEqual([2, 0, 1])
    expect(out.profiles[0].valueMaps.skill).toEqual({ 'split service': 'Service' })
    const single = { ...fixture(), site: { ...fixture().site, skills: ['Only'], workTypes: [] }, technicians: [] as Workspace['technicians'] }
    expect(bad(a.removeSkill(single, 'Only'))).toBe('A site needs at least one skill.')
    expect(bad(a.removeSkill(fixture(), 'Nope'))).toBe('That skill does not exist.')
  })
})

describe('priority levels', () => {
  it('adds, changes the weight, renames with cascades and moves', () => {
    expect(good(a.addLevel(fixture(), 'Emergency', 500)).site.priorityLevels.map((l) => l.name)).toEqual(['Normal', 'Escalated', 'Emergency'])
    expect(bad(a.addLevel(fixture(), 'normal', 1))).toBe('That name is already used.')
    expect(bad(a.addLevel(fixture(), '', 1))).toBe('Write a name.')
    expect(bad(a.addLevel(fixture(), 'X', -1))).toBe('The weight must be 0 or more.')
    expect(good(a.updateLevel(fixture(), 'Escalated', { weight: 250 })).site.priorityLevels[1].weight).toBe(250)
    expect(bad(a.updateLevel(fixture(), 'Escalated', { weight: -2 }))).toBe('The weight must be 0 or more.')
    expect(bad(a.updateLevel(fixture(), 'Nope', {}))).toBe('That level does not exist.')
    const r = good(a.renameLevel(fixture(), 'Escalated', 'Urgent'))
    expect(r.cases[0].priorityLevel).toBe('Urgent')
    expect(r.profiles[0].valueMaps.priority.p1).toBe('Urgent')
    expect(bad(a.renameLevel(fixture(), 'Escalated', 'NORMAL'))).toBe('That name is already used.')
    expect(bad(a.renameLevel(fixture(), 'Escalated', ' '))).toBe('Write a name.')
    expect(bad(a.renameLevel(fixture(), 'Nope', 'X'))).toBe('That level does not exist.')
    const m = good(a.moveLevel(fixture(), 'Escalated', -1))
    expect(m.site.priorityLevels.map((l) => l.name)).toEqual(['Escalated', 'Normal'])
    expect(good(a.moveLevel(fixture(), 'Normal', -1)).site.priorityLevels.map((l) => l.name)).toEqual(['Normal', 'Escalated'])
    expect(good(a.moveLevel(fixture(), 'Escalated', 1)).site.priorityLevels.map((l) => l.name)).toEqual(['Normal', 'Escalated'])
    expect(bad(a.moveLevel(fixture(), 'Nope', 1))).toBe('That level does not exist.')
  })
  it('refuses to remove a level cases use or the last one', () => {
    expect(bad(a.removeLevel(fixture(), 'Escalated'))).toBe('1 case uses this level.')
    const w = { ...fixture(), cases: [] }
    const out = good(a.removeLevel(w, 'Escalated'))
    expect(out.site.priorityLevels.map((l) => l.name)).toEqual(['Normal'])
    expect(out.profiles[0].valueMaps.priority).toEqual({})
    expect(bad(a.removeLevel(out, 'Normal'))).toBe('A site needs at least one priority level.')
    expect(bad(a.removeLevel(fixture(), 'Nope'))).toBe('That level does not exist.')
  })
})

describe('places and aliases', () => {
  it('adds a place, with checks', () => {
    const w = good(a.addPlace(fixture(), { name: ' East Side ', latitude: 20, longitude: 30.3, postalCode: ' 333 ', zone: '' }))
    expect(w.site.places[2]).toEqual({ name: 'East Side', latitude: 20, longitude: 30.3, postalCode: '333' })
    expect(bad(a.addPlace(fixture(), { name: '', latitude: 1, longitude: 1 }))).toBe('Write a name.')
    expect(bad(a.addPlace(fixture(), { name: 'north town', latitude: 1, longitude: 1 }))).toBe('That name is already used.')
    expect(bad(a.addPlace(fixture(), { name: 'X', latitude: 99, longitude: 1 }))).toBe('Latitude must be between -90 and 90.')
    expect(bad(a.addPlace(fixture(), { name: 'X', latitude: 1, longitude: 999 }))).toBe('Longitude must be between -180 and 180.')
  })
  it('updates a place and clears optional fields', () => {
    const w = good(a.updatePlace(fixture(), 'North Town', { latitude: 20.2, postalCode: '', zone: ' North ' }))
    expect(w.site.places[0]).toEqual({ name: 'North Town', latitude: 20.2, longitude: 30.05, zone: 'North' })
    expect(bad(a.updatePlace(fixture(), 'Nope', {}))).toBe('That place does not exist.')
    expect(bad(a.updatePlace(fixture(), 'North Town', { longitude: 500 }))).toBe('Longitude must be between -180 and 180.')
  })
  it('renames a place everywhere it is used', () => {
    const w = good(a.renamePlace(fixture(), 'North Town', 'Northville'))
    expect(w.site.places[0].name).toBe('Northville')
    expect(w.site.aliases['n town']).toBe('Northville')
    expect(w.cases[0].place).toBe('Northville')
    expect(w.technicians[0]).toMatchObject({ startPlace: 'Northville', endPlace: 'Northville' })
    expect(bad(a.renamePlace(fixture(), 'North Town', 'south bay'))).toBe('That name is already used.')
    expect(bad(a.renamePlace(fixture(), 'North Town', ''))).toBe('Write a name.')
    expect(bad(a.renamePlace(fixture(), 'Nope', 'X'))).toBe('That place does not exist.')
  })
  it('refuses to remove a place in use, and drops its aliases when it is free', () => {
    expect(bad(a.removePlace(fixture(), 'North Town'))).toBe('1 case uses this place.')
    const noCases = { ...fixture(), cases: [] }
    expect(bad(a.removePlace(noCases, 'North Town'))).toBe('A technician starts or ends the day here.')
    const free = { ...noCases, technicians: [{ name: 'Ann', skills: ['Service'], active: true }] }
    const out = good(a.removePlace(free, 'North Town'))
    expect(out.site.places.map((p) => p.name)).toEqual(['South Bay'])
    expect(out.site.aliases).toEqual({})
    expect(bad(a.removePlace(fixture(), 'Nope'))).toBe('That place does not exist.')
  })
  it('adds and removes aliases, storing the spelling normalised', () => {
    const w = good(a.addAlias(fixture(), '  S. BAY ', 'South Bay'))
    expect(w.site.aliases['s bay']).toBe('South Bay')
    expect(bad(a.addAlias(fixture(), '', 'South Bay'))).toBe('Write the spelling to match.')
    expect(bad(a.addAlias(fixture(), 'x', 'Nope'))).toBe('Choose a place that exists.')
    expect(a.removeAlias(w, 'S BAY').site.aliases['s bay']).toBeUndefined()
    expect(a.removeAlias(w, 'S BAY').site.aliases['n town']).toBe('North Town')
  })
})

describe('technicians', () => {
  it('adds a technician with real skills', () => {
    const w = good(a.addTechnician(fixture(), { name: ' Cy ', skills: ['service', 'Service', 'Breakdown'] }))
    expect(w.technicians[2]).toEqual({ name: 'Cy', skills: ['Service', 'Breakdown'], active: true })
    expect(bad(a.addTechnician(fixture(), { name: '', skills: [] }))).toBe('Write a name.')
    expect(bad(a.addTechnician(fixture(), { name: 'ann', skills: [] }))).toBe('That name is already used.')
    expect(bad(a.addTechnician(fixture(), { name: 'Cy', skills: ['Plumbing'] }))).toBe('Choose skills that exist.')
  })
  it('updates details, with checks, and removes fields set to undefined', () => {
    const w = good(a.updateTechnician(fixture(), 'Ann', {
      skills: ['Breakdown'], startPlace: 'South Bay', endPlace: undefined, leaveFrom: '2026-10-20', leaveTo: '2026-10-22',
      shiftStart: 510, shiftHours: 7.5, breakMin: 30, active: false,
    }))
    expect(w.technicians[0]).toEqual({ name: 'Ann', skills: ['Breakdown'], active: false, startPlace: 'South Bay', leaveFrom: '2026-10-20', leaveTo: '2026-10-22', shiftStart: 510, shiftHours: 7.5, breakMin: 30 })
    const dateMsg = 'Write the date as year-month-day, for example 2026-12-25.'
    expect(bad(a.updateTechnician(fixture(), 'Nope', {}))).toBe('That technician does not exist.')
    expect(bad(a.updateTechnician(fixture(), 'Ann', { skills: ['Plumbing'] }))).toBe('Choose skills that exist.')
    expect(bad(a.updateTechnician(fixture(), 'Ann', { startPlace: 'Nowhere' }))).toBe('Choose a place that exists.')
    expect(bad(a.updateTechnician(fixture(), 'Ann', { leaveFrom: '20/10/2026' }))).toBe(dateMsg)
    expect(bad(a.updateTechnician(fixture(), 'Ann', { leaveFrom: '2026-02-30' }))).toBe(dateMsg)
    expect(bad(a.updateTechnician(fixture(), 'Ann', { leaveFrom: '2026-10-22', leaveTo: '2026-10-20' }))).toBe('The leave cannot end before it starts.')
    expect(bad(a.updateTechnician(fixture(), 'Ann', { shiftStart: 2000 }))).toBe('The shift start must be a time of day.')
    expect(bad(a.updateTechnician(fixture(), 'Ann', { shiftHours: 0 }))).toBe('Shift hours must be more than 0 and at most 24.')
    expect(bad(a.updateTechnician(fixture(), 'Ann', { breakMin: -1 }))).toBe('The break must be 0 minutes or more.')
  })
  it('toggles and removes', () => {
    expect(a.toggleTechnician(fixture(), 'Ann').technicians[0].active).toBe(false)
    expect(a.toggleTechnician(a.toggleTechnician(fixture(), 'Ann'), 'Ann').technicians[0].active).toBe(true)
    expect(a.toggleTechnician(fixture(), 'Nobody').technicians.every((t) => t.active)).toBe(true)
    expect(a.removeTechnician(fixture(), 'Ann').technicians.map((t) => t.name)).toEqual(['Bo'])
  })
})

describe('holidays and the whole site', () => {
  it('adds real dates once, kept sorted, and removes them', () => {
    let w = good(a.addHoliday(fixture(), '2026-12-25'))
    w = good(a.addHoliday(w, '2026-10-02'))
    expect(w.holidays).toEqual(['2026-10-02', '2026-12-25'])
    expect(bad(a.addHoliday(w, '2026-12-25'))).toBe('That day is already a holiday.')
    expect(bad(a.addHoliday(w, 'Christmas'))).toBe('Write the date as year-month-day, for example 2026-12-25.')
    expect(bad(a.addHoliday(w, '2026-13-01'))).toContain('year-month-day')
    expect(a.removeHoliday(w, '2026-10-02').holidays).toEqual(['2026-12-25'])
  })
  it('replaces the site and keeps the data', () => {
    const w = fixture()
    const out = a.replaceSite(w, { ...w.site, name: 'Other' })
    expect(out.site.name).toBe('Other')
    expect(out.cases).toBe(w.cases)
  })
})
