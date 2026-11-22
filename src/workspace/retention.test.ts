import { describe, expect, it } from 'vitest'
import type { StoredCase, StoredState } from '../intake/import/merge'
import type { StoredReport } from './reportRecords'
import { applyRetention, isRetentionDays, previewRetention, RETENTION_CHOICES, setRetention } from './retention'
import { emptyWorkspace, readWorkspace, type Workspace } from './workspace'

const TODAY = '2026-11-22'
const daysAgo = (n: number): string => new Date(Date.parse(`${TODAY}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)

const kase = (caseId: string, state: StoredState, over: Partial<StoredCase> = {}): StoredCase =>
  ({ caseId, state, overrides: {}, firstImported: '2026-01-01', lastImported: '2026-01-01', ...over }) as StoredCase
const report = (caseId: string, date: string): StoredReport => ({ caseId, status: 'done', date, technician: 'Asha', reportedAt: `${date}T10:00:00.000Z` })
const change = (caseId: string) => ({ caseId, field: 'status', previous: 'open', next: 'closed', reason: 'import' })

function workspace(over: Partial<Workspace>): Workspace {
  return { ...emptyWorkspace(), ...over }
}

describe('the choices', () => {
  it('are a fixed list, and anything else is not a choice', () => {
    expect([...RETENTION_CHOICES]).toEqual([30, 90, 180, 365])
    expect(isRetentionDays(90)).toBe(true)
    for (const v of [0, 1, 45, -30, 30.5, '90', null, undefined, NaN]) expect(isRetentionDays(v)).toBe(false)
  })
})

describe('applyRetention with the setting off', () => {
  it('does nothing at all and gives back the same workspace', () => {
    const w = workspace({ cases: [kase('A1', 'closed'), kase('A2', 'done', { closedAt: daysAgo(900) })], reports: [report('A1', daysAgo(900))] })
    const r = applyRetention(w, TODAY)
    expect(r.workspace).toBe(w)
    expect(r.removed).toEqual({ cases: 0, reports: 0, changes: 0 })
  })
})

describe('applyRetention with a period', () => {
  it('starts the clock today for a finished case that has none, and removes nothing on that day', () => {
    const w = workspace({ retentionDays: 30, cases: [kase('A1', 'closed'), kase('A2', 'done'), kase('A3', 'active')] })
    const r = applyRetention(w, TODAY)
    expect(r.removed).toEqual({ cases: 0, reports: 0, changes: 0 })
    expect(r.workspace.cases.map((c) => [c.caseId, c.closedAt])).toEqual([['A1', TODAY], ['A2', TODAY], ['A3', undefined]])
  })
  it('keeps a finished case on the last day of the period and removes it the day after', () => {
    const w = workspace({ retentionDays: 30, cases: [kase('KEEP', 'closed', { closedAt: daysAgo(30) }), kase('GO', 'closed', { closedAt: daysAgo(31) })] })
    const r = applyRetention(w, TODAY)
    expect(r.workspace.cases.map((c) => c.caseId)).toEqual(['KEEP'])
    expect(r.removed.cases).toBe(1)
  })
  it('never removes a case that is not finished, however old', () => {
    const w = workspace({ retentionDays: 30, cases: (['active', 'hold', 'review', 'ignored'] as const).map((s, i) => kase(`A${i}`, s, { firstImported: '2020-01-01', lastImported: '2020-01-01' })) })
    const r = applyRetention(w, TODAY)
    expect(r.workspace.cases).toHaveLength(4)
    expect(r.workspace).toBe(w)
  })
  it('removes reports by the day of the route, and keeps the ones inside the period', () => {
    const w = workspace({ retentionDays: 90, reports: [report('A1', daysAgo(91)), report('A2', daysAgo(90)), report('A3', daysAgo(1))] })
    const r = applyRetention(w, TODAY)
    expect(r.workspace.reports.map((x) => x.caseId)).toEqual(['A2', 'A3'])
    expect(r.removed.reports).toBe(1)
  })
  it('removes the change-log lines of removed cases, and only those', () => {
    const w = workspace({
      retentionDays: 30,
      cases: [kase('GO', 'closed', { closedAt: daysAgo(40) }), kase('STAY', 'closed', { closedAt: daysAgo(5) }), kase('OPEN', 'active')],
      changes: [change('GO'), change('STAY'), change('OPEN'), change('GO')],
    })
    const r = applyRetention(w, TODAY)
    expect(r.workspace.changes.map((c) => c.caseId)).toEqual(['STAY', 'OPEN'])
    expect(r.removed).toEqual({ cases: 1, reports: 0, changes: 2 })
  })
  it('takes the stamp off a case that is no longer finished (it came back in an import)', () => {
    const w = workspace({ retentionDays: 30, cases: [kase('A1', 'active', { closedAt: daysAgo(100) })] })
    const r = applyRetention(w, TODAY)
    expect(r.workspace.cases[0].closedAt).toBeUndefined()
    expect('closedAt' in r.workspace.cases[0]).toBe(false)
    expect(r.removed.cases).toBe(0)
  })
  it('does not trust a stamp that is not a date: the clock starts today', () => {
    for (const bad of ['', 'soon', '2026-13-45', '22/11/2026', '2026-11-22T10:00:00Z']) {
      const r = applyRetention(workspace({ retentionDays: 30, cases: [kase('A1', 'closed', { closedAt: bad })] }), TODAY)
      expect(r.workspace.cases[0].closedAt).toBe(TODAY)
    }
  })
  it('gives back the same workspace on a second pass, so nothing is saved or planned again', () => {
    const once = applyRetention(workspace({ retentionDays: 30, cases: [kase('A1', 'closed'), kase('A2', 'closed', { closedAt: daysAgo(99) })], reports: [report('A1', daysAgo(99))] }), TODAY)
    const twice = applyRetention(once.workspace, TODAY)
    expect(twice.workspace).toBe(once.workspace)
    expect(twice.removed).toEqual({ cases: 0, reports: 0, changes: 0 })
  })
  it('does not change the workspace it was given', () => {
    const w = workspace({ retentionDays: 30, cases: [kase('A1', 'closed'), kase('A2', 'closed', { closedAt: daysAgo(99) })], reports: [report('A1', daysAgo(99))], changes: [change('A2')] })
    const copy = structuredClone(w)
    applyRetention(w, TODAY)
    expect(w).toEqual(copy)
  })
  it('leaves everything else alone', () => {
    const w = workspace({ retentionDays: 30, holidays: ['2026-12-25'], lastBackupAt: '2026-11-01', cases: [kase('A1', 'closed', { closedAt: daysAgo(99) })] })
    const r = applyRetention(w, TODAY).workspace
    expect(r.holidays).toEqual(['2026-12-25'])
    expect(r.lastBackupAt).toBe('2026-11-01')
    expect(r.site).toBe(w.site)
    expect(r.retentionDays).toBe(30)
  })
})

describe('previewRetention', () => {
  const w = workspace({
    cases: [kase('OLD', 'closed', { closedAt: daysAgo(200) }), kase('NEW', 'done'), kase('FRESH', 'closed', { closedAt: daysAgo(3) }), kase('OPEN', 'active')],
    reports: [report('A1', daysAgo(200)), report('A2', daysAgo(10))],
  })
  it('says what applying a period would remove now, and how many cases are finished and stay', () => {
    expect(previewRetention(w, 90, TODAY)).toEqual({ removeNow: { cases: 1, reports: 1, changes: 0 }, finishedKept: 2 })
  })
  it('agrees with what setRetention then removes', () => {
    const p = previewRetention(w, 90, TODAY)
    const r = setRetention(w, 90, TODAY)
    expect(r.removed).toEqual(p.removeNow)
    expect(r.workspace.cases.filter((c) => c.state === 'closed' || c.state === 'done')).toHaveLength(p.finishedKept)
  })
  it('does not change the workspace', () => {
    const copy = structuredClone(w)
    previewRetention(w, 30, TODAY)
    expect(w).toEqual(copy)
  })
})

describe('setRetention', () => {
  it('switches a period on, stamping finished cases that have no date', () => {
    const r = setRetention(workspace({ cases: [kase('A1', 'done'), kase('A2', 'active')] }), 180, TODAY)
    expect(r.workspace.retentionDays).toBe(180)
    expect(r.workspace.cases.map((c) => c.closedAt)).toEqual([TODAY, undefined])
  })
  it('changes the period, and a shorter one removes what the longer one kept', () => {
    const w = workspace({ retentionDays: 365, cases: [kase('A1', 'closed', { closedAt: daysAgo(100) })] })
    expect(applyRetention(w, TODAY).workspace.cases).toHaveLength(1)
    const r = setRetention(w, 90, TODAY)
    expect(r.workspace.retentionDays).toBe(90)
    expect(r.workspace.cases).toHaveLength(0)
    expect(r.removed.cases).toBe(1)
  })
  it('switches it off: the setting and every stamp go, nothing else is removed, and on again starts a fresh clock', () => {
    const on = workspace({ retentionDays: 30, cases: [kase('A1', 'closed', { closedAt: daysAgo(10) })], reports: [report('A1', daysAgo(500))] })
    const off = setRetention(on, undefined, TODAY)
    expect(off.workspace.retentionDays).toBeUndefined()
    expect('retentionDays' in off.workspace).toBe(false)
    expect('closedAt' in off.workspace.cases[0]).toBe(false)
    expect(off.workspace.reports).toHaveLength(1)
    expect(off.removed).toEqual({ cases: 0, reports: 0, changes: 0 })
    const again = setRetention(off.workspace, 30, '2027-06-01')
    expect(again.workspace.cases[0].closedAt).toBe('2027-06-01')
  })
  it('is no change at all when it is switched off and was off', () => {
    const w = workspace({ cases: [kase('A1', 'closed')] })
    const r = setRetention(w, undefined, TODAY)
    expect(r.workspace).toBe(w)
  })
})

describe('reading a workspace', () => {
  it('keeps a valid period and the stamps', () => {
    const w = readWorkspace({ ...workspace({ retentionDays: 90, cases: [kase('A1', 'closed', { closedAt: '2026-11-01' })] }) })
    expect(w.retentionDays).toBe(90)
    expect(w.cases[0].closedAt).toBe('2026-11-01')
  })
  it('drops a period that is not one of the choices, so a damaged backup cannot switch on a strange one', () => {
    for (const bad of [0, 1, 45, -90, '90', null, {}, [90]]) {
      const w = readWorkspace({ ...emptyWorkspace(), retentionDays: bad })
      expect(w.retentionDays).toBeUndefined()
      expect('retentionDays' in w).toBe(false)
    }
  })
})
