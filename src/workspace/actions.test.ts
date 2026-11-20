import { describe, expect, it } from 'vitest'
import type { Imported, ImportedCase, ImportedTechnician, IntakeException } from '../intake/map/apply'
import type { MappingProfile } from '../intake/map/profile'
import { applyImport, previewImport, profileFor, setCaseOverride } from './actions'
import { emptyWorkspace, type Workspace } from './workspace'

const quality = { rowsRead: 0, blankRowsSkipped: 0, totalRowsSkipped: 0, raggedRows: 0, filled: {}, duplicates: 0, badDates: [], unknownValues: [], unresolvedPlaces: 0 }
const profile = (fingerprint = 'aaaa1111', kind: MappingProfile['kind'] = 'cases', name = 'p'): MappingProfile => ({
  profileVersion: 1, name, kind, fingerprint, formats: {}, columns: {}, valueMaps: { workType: {}, status: {}, priority: {}, skill: {} },
})
const c = (id: string, over: Partial<ImportedCase> = {}): ImportedCase => ({ caseId: id, workTypeName: 'Service', place: 'North', state: 'active', ...over })
const cases = (list: ImportedCase[], exceptions: IntakeException[] = [], places: Imported['places'] = []): Imported => ({ kind: 'cases', cases: list, technicians: [], places, exceptions, quality })
const techs = (list: ImportedTechnician[]): Imported => ({ kind: 'technicians', cases: [], technicians: list, places: [], exceptions: [], quality })
const placesFile = (places: Imported['places']): Imported => ({ kind: 'places', cases: [], technicians: [], places, exceptions: [], quality })
const D1 = '2026-10-13'
const D2 = '2026-10-14'

describe('applyImport: cases', () => {
  it('merges cases, adds the change log and an import record, saves the profile, and adds created places', () => {
    const w0 = emptyWorkspace()
    const frozen = JSON.stringify(w0)
    const { workspace: w1, preview } = applyImport(w0, cases([c('1'), c('2')], [], [{ name: 'Hill', latitude: 1, longitude: 2 }]), profile(), 'cases.csv', D1)
    expect(preview).toMatchObject({ new: 2, updated: 0 })
    expect(w1.cases.map((x) => x.caseId)).toEqual(['1', '2'])
    expect(w1.site.places.map((p) => p.name)).toEqual(['Hill'])
    expect(w1.profiles).toHaveLength(1)
    expect(w1.imports).toEqual([{ at: D1, fileName: 'cases.csv', kind: 'cases', preview }])
    expect(JSON.stringify(w0)).toBe(frozen)

    const { workspace: w2, preview: p2 } = applyImport(w1, cases([c('1', { dueAt: '2026-10-20' }), c('2')]), profile(), 'cases.csv', D2)
    expect(p2).toMatchObject({ new: 0, updated: 1, unchanged: 1 })
    expect(w2.changes).toEqual([{ caseId: '1', field: 'dueAt', previous: '', next: '2026-10-20', reason: 'import' }])
    expect(w2.imports).toHaveLength(2)
    expect(w2.profiles).toHaveLength(1) // same layout: replaced, not added
  })
  it('keeps one profile per kind and layout', () => {
    let w = emptyWorkspace()
    w = applyImport(w, cases([c('1')]), profile('a', 'cases', 'first'), 'a.csv', D1).workspace
    w = applyImport(w, cases([c('1')]), profile('b', 'cases'), 'b.csv', D1).workspace
    w = applyImport(w, techs([]), profile('a', 'technicians'), 't.csv', D1).workspace
    w = applyImport(w, cases([c('1')]), profile('a', 'cases', 'renamed'), 'a.csv', D2).workspace
    expect(w.profiles.map((p) => [p.kind, p.fingerprint, p.name])).toEqual([['cases', 'b', 'p'], ['technicians', 'a', 'p'], ['cases', 'a', 'renamed']])
  })
  it('previewImport gives the same counts as applyImport', () => {
    const w = applyImport(emptyWorkspace(), cases([c('1')]), profile(), 'x', D1).workspace
    const imp = cases([c('1'), c('2')])
    expect(previewImport(w, imp, profile(), D2)).toEqual(applyImport(w, imp, profile(), 'x', D2).preview)
  })
})

describe('applyImport: technicians and places', () => {
  const t = (name: string, over: Partial<ImportedTechnician> = {}): ImportedTechnician => ({ name, skills: ['Service'], active: true, ...over })
  it('merges technicians by name: updated, new, and none removed', () => {
    let w: Workspace = applyImport(emptyWorkspace(), techs([t('Ann'), t('Bo')]), profile('t', 'technicians'), 't.csv', D1).workspace
    const r = applyImport(w, techs([t(' ann ', { active: false }), t('Cy')]), profile('t', 'technicians'), 't.csv', D2)
    w = r.workspace
    expect(r.preview).toMatchObject({ new: 1, updated: 1, unchanged: 0, removed: 0 })
    expect(w.technicians.map((x) => [x.name, x.active])).toEqual([[' ann ', false], ['Bo', true], ['Cy', true]])
    const again = applyImport(w, techs([t('Bo')]), profile('t', 'technicians'), 't.csv', D2)
    expect(again.preview.unchanged).toBe(1)
  })
  it('adds places once and reports the rest as unchanged', () => {
    const file = placesFile([{ name: 'North', latitude: 1, longitude: 2 }, { name: 'South', latitude: 3, longitude: 4 }])
    const first = applyImport(emptyWorkspace(), file, profile('p', 'places'), 'p.csv', D1)
    expect(first.preview).toMatchObject({ new: 2, unchanged: 0 })
    expect(first.workspace.site.places.map((p) => p.name)).toEqual(['North', 'South'])
    const second = applyImport(first.workspace, file, profile('p', 'places'), 'p.csv', D2)
    expect(second.preview).toMatchObject({ new: 0, unchanged: 2 })
    expect(second.workspace.site.places).toHaveLength(2)
  })
  it('counts duplicate and missing-name rows from the exceptions', () => {
    const ex: IntakeException[] = [
      { caseId: 'Ann', issue: 'duplicate_id', detail: '', suggestedAction: '' },
      { caseId: '(row 3)', issue: 'missing_id', detail: '', suggestedAction: '' },
    ]
    const r = applyImport(emptyWorkspace(), { ...techs([t('Ann')]), exceptions: ex }, profile('t', 'technicians'), 't', D1)
    expect(r.preview).toMatchObject({ new: 1, duplicate: 1, incomplete: 1 })
  })
})

describe('setCaseOverride and profileFor', () => {
  const base = applyImport(emptyWorkspace(), cases([c('1'), c('2')]), profile(), 'x', D1).workspace
  it('merges overrides into one case only', () => {
    const w = setCaseOverride(base, '1', { technician: 'Ann', date: '2026-10-15' })
    expect(w.cases[0].overrides).toEqual({ technician: 'Ann', date: '2026-10-15' })
    expect(w.cases[1].overrides).toEqual({})
    expect(setCaseOverride(w, '1', { technician: undefined }).cases[0].overrides).toEqual({ date: '2026-10-15' })
  })
  it('marks a case done and brings it back', () => {
    const done = setCaseOverride(base, '1', { done: true })
    expect(done.cases[0].state).toBe('done')
    expect(setCaseOverride(done, '1', { done: false }).cases[0].state).toBe('active')
  })
  it('finds a saved profile by kind and layout', () => {
    expect(profileFor(base, 'cases', 'aaaa1111')?.fingerprint).toBe('aaaa1111')
    expect(profileFor(base, 'technicians', 'aaaa1111')).toBeUndefined()
    expect(profileFor(base, 'cases', 'zzzz')).toBeUndefined()
  })
})
