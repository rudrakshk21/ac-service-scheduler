import { describe, expect, it } from 'vitest'
import type { Imported, ImportedCase, IntakeException } from '../map/apply'
import { mergeImport, type StoredCase } from './merge'

const quality = { rowsRead: 0, blankRowsSkipped: 0, totalRowsSkipped: 0, raggedRows: 0, filled: {}, duplicates: 0, badDates: [], unknownValues: [], unresolvedPlaces: 0 }
const imported = (cases: ImportedCase[], exceptions: IntakeException[] = []): Imported => ({ kind: 'cases', cases, technicians: [], places: [], exceptions, quality })
const c = (id: string, over: Partial<ImportedCase> = {}): ImportedCase => ({ caseId: id, workTypeName: 'Service', place: 'North', state: 'active', ...over })
const D1 = '2026-10-13'
const D2 = '2026-10-14'
const first = (cs: ImportedCase[]) => mergeImport([], imported(cs), D1)

describe('mergeImport: first import', () => {
  it('stores every case with the import date, empty overrides and counts them as new', () => {
    const r = first([c('1'), c('2', { state: 'hold' })])
    expect(r.cases).toEqual([
      { ...c('1'), overrides: {}, firstImported: D1, lastImported: D1 },
      { ...c('2', { state: 'hold' }), overrides: {}, firstImported: D1, lastImported: D1 },
    ])
    expect(r.preview).toEqual({ new: 2, updated: 0, unchanged: 0, duplicate: 0, incomplete: 0, removed: 0 })
    expect(r.changes).toEqual([])
  })
})

describe('mergeImport: repeat imports', () => {
  it('identical data is unchanged; only lastImported moves', () => {
    const before = first([c('1'), c('2')]).cases
    const r = mergeImport(before, imported([c('1'), c('2')]), D2)
    expect(r.preview).toMatchObject({ new: 0, updated: 0, unchanged: 2, removed: 0 })
    expect(r.cases.map((x) => [x.firstImported, x.lastImported])).toEqual([[D1, D2], [D1, D2]])
    expect(r.changes).toEqual([])
  })
  it('counts a changed case once and logs one entry per changed field', () => {
    const before = first([c('1', { dueAt: '2026-10-20', area: 'North' })]).cases
    const r = mergeImport(before, imported([c('1', { dueAt: '2026-10-22', area: 'South', place: 'South' })]), D2)
    expect(r.preview.updated).toBe(1)
    expect(r.changes).toEqual([
      { caseId: '1', field: 'area', previous: 'North', next: 'South', reason: 'import' },
      { caseId: '1', field: 'dueAt', previous: '2026-10-20', next: '2026-10-22', reason: 'import' },
      { caseId: '1', field: 'place', previous: 'North', next: 'South', reason: 'import' },
    ])
    expect(r.cases[0].dueAt).toBe('2026-10-22')
  })
  it('follows a state change in the import and logs it', () => {
    const before = first([c('1')]).cases
    const r = mergeImport(before, imported([c('1', { state: 'hold', status: 'Pending' })]), D2)
    expect(r.cases[0].state).toBe('hold')
    expect(r.changes).toContainEqual({ caseId: '1', field: 'state', previous: 'active', next: 'hold', reason: 'import' })
  })
  it('never writes a customer name into the change log', () => {
    const before = first([c('1', { customerName: 'Person A' })]).cases
    const r = mergeImport(before, imported([c('1', { customerName: 'Person B' })]), D2)
    expect(JSON.stringify(r.changes)).not.toContain('Person')
    expect(r.cases[0].customerName).toBe('Person B')
  })
})

describe('mergeImport: cases that disappear and return', () => {
  it('closes a case that is missing from a full export and counts it as removed', () => {
    const before = first([c('1'), c('2')]).cases
    const r = mergeImport(before, imported([c('1')]), D2)
    expect(r.cases.map((x) => [x.caseId, x.state])).toEqual([['1', 'active'], ['2', 'closed']])
    expect(r.preview.removed).toBe(1)
    expect(r.changes).toEqual([{ caseId: '2', field: 'state', previous: 'active', next: 'closed', reason: 'missing from import' }])
  })
  it('leaves missing cases alone when the file is not a full export', () => {
    const before = first([c('1'), c('2')]).cases
    const r = mergeImport(before, imported([c('1')]), D2, { fullExport: false })
    expect(r.cases[1].state).toBe('active')
    expect(r.preview.removed).toBe(0)
  })
  it('does not close a case the user marked done, and does not close it twice', () => {
    const stored: StoredCase[] = [
      { ...first([c('1')]).cases[0], state: 'done', overrides: { done: true } },
      { ...first([c('2')]).cases[0], state: 'closed' },
    ]
    const r = mergeImport(stored, imported([]), D2)
    expect(r.cases.map((x) => x.state)).toEqual(['done', 'closed'])
    expect(r.preview.removed).toBe(0)
  })
  it('brings a closed case back when it appears again', () => {
    const closed: StoredCase[] = [{ ...first([c('1')]).cases[0], state: 'closed' }]
    const r = mergeImport(closed, imported([c('1')]), D2)
    expect(r.cases[0].state).toBe('active')
    expect(r.preview.updated).toBe(1)
    expect(r.changes).toEqual([{ caseId: '1', field: 'state', previous: 'closed', next: 'active', reason: 'reappeared in import' }])
  })
})

describe('mergeImport: user decisions survive', () => {
  const decided = (): StoredCase[] => [{
    ...first([c('1')]).cases[0], overrides: { technician: 'T1', date: '2026-10-14', workType: 'Service', done: true }, state: 'done',
  }]
  it('keeps all overrides, and done stays done even when the import says active', () => {
    const r = mergeImport(decided(), imported([c('1')]), D2)
    expect(r.cases[0].overrides).toEqual({ technician: 'T1', date: '2026-10-14', workType: 'Service', done: true })
    expect(r.cases[0].state).toBe('done')
  })
  it('a work type chosen for a review case makes it active and sets the work type', () => {
    const review: StoredCase[] = [{ ...first([c('1', { workTypeName: undefined, state: 'review' })]).cases[0], overrides: { workType: 'Breakdown' } }]
    const r = mergeImport(review, imported([c('1', { workTypeName: undefined, state: 'review' })]), D2)
    expect(r.cases[0].state).toBe('active')
    expect(r.cases[0].workTypeName).toBe('Breakdown')
  })
  it('a mapped work type in the import wins over the override', () => {
    const review: StoredCase[] = [{ ...first([c('1')]).cases[0], overrides: { workType: 'Breakdown' } }]
    expect(mergeImport(review, imported([c('1', { workTypeName: 'Installation' })]), D2).cases[0].workTypeName).toBe('Installation')
  })
})

describe('mergeImport: counts and purity', () => {
  it('counts duplicates and incomplete rows from the exceptions', () => {
    const ex: IntakeException[] = [
      { caseId: '1', issue: 'duplicate_id', detail: '', suggestedAction: '' },
      { caseId: '(row 4)', issue: 'missing_id', detail: '', suggestedAction: '' },
      { caseId: '2', issue: 'no_location', detail: '', suggestedAction: '' },
    ]
    const r = mergeImport([], imported([c('1')], ex), D1)
    expect(r.preview).toMatchObject({ new: 1, duplicate: 1, incomplete: 1 })
  })
  it('puts existing cases first, then new ones in import order, and changes none of its inputs', () => {
    const before = first([c('1'), c('2')]).cases
    const inc = imported([c('3'), c('2', { dueAt: '2026-11-01' }), c('1')])
    const frozen = JSON.stringify([before, inc])
    const r = mergeImport(before, inc, D2)
    expect(r.cases.map((x) => x.caseId)).toEqual(['1', '2', '3'])
    expect(r.preview).toMatchObject({ new: 1, updated: 1, unchanged: 1 })
    expect(JSON.stringify([before, inc])).toBe(frozen)
  })
})
