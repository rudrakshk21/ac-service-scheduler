import { describe, expect, it } from 'vitest'
import type { ReportFile, Visit } from '../share/report'
import type { StoredCase } from '../intake/import/merge'
import { readStoredReports } from './reportRecords'
import { clearReports, daySummary, markReportedDone, mergeReports } from './reports'
import { readWorkspace, emptyWorkspace, type Workspace } from './workspace'

const file = (technician: string, date: string, createdAt: string, visits: Visit[]): ReportFile => ({ reportVersion: 1, site: 'Centre', technician, date, createdAt, visits })
const done = (caseId: string, over: Partial<Visit> = {}): Visit => ({ caseId, status: 'done', finishedAt: '10:00', ...over })
const D = '2026-11-23'
const T1 = '2026-11-23T10:00:00.000Z'
const T2 = '2026-11-23T12:00:00.000Z'

describe('mergeReports', () => {
  it('adds the visits of a file, with who reported them, for which day, and when', () => {
    const r = mergeReports(emptyWorkspace(), [file('Asha', D, T1, [done('A1'), { caseId: 'A2', status: 'not_done', reason: 'no_access', remarks: 'locked' }])])
    expect(r.counts).toEqual({ files: 1, added: 2, updated: 0, unchanged: 0, older: 0 })
    expect(r.workspace.reports).toEqual([
      { caseId: 'A1', status: 'done', finishedAt: '10:00', date: D, technician: 'Asha', reportedAt: T1 },
      { caseId: 'A2', status: 'not_done', reason: 'no_access', remarks: 'locked', date: D, technician: 'Asha', reportedAt: T1 },
    ])
  })
  it('knows a file it has read already: nothing changes the second time', () => {
    const f = file('Asha', D, T1, [done('A1')])
    const once = mergeReports(emptyWorkspace(), [f]).workspace
    const twice = mergeReports(once, [f])
    expect(twice.counts).toMatchObject({ added: 0, updated: 0, unchanged: 1 })
    expect(twice.workspace.reports).toEqual(once.reports)
  })
  it('lets a newer report replace an older one for the same case and day', () => {
    const first = mergeReports(emptyWorkspace(), [file('Asha', D, T1, [{ caseId: 'A1', status: 'not_done', reason: 'part_missing' }])]).workspace
    const next = mergeReports(first, [file('Asha', D, T2, [done('A1', { remarks: 'fixed after all' })])])
    expect(next.counts).toMatchObject({ added: 0, updated: 1 })
    expect(next.workspace.reports).toHaveLength(1)
    expect(next.workspace.reports[0]).toMatchObject({ status: 'done', remarks: 'fixed after all', reportedAt: T2 })
    expect(next.workspace.reports[0].reason).toBeUndefined()
  })
  it('does not let an older report replace a newer one, whatever order the files are opened in', () => {
    const newer = file('Asha', D, T2, [done('A1', { remarks: 'new' })])
    const older = file('Asha', D, T1, [{ caseId: 'A1', status: 'not_done' }])
    const r = mergeReports(emptyWorkspace(), [newer, older])
    expect(r.counts).toMatchObject({ added: 1, older: 1 })
    expect(r.workspace.reports[0]).toMatchObject({ status: 'done', remarks: 'new' })
    const backwards = mergeReports(emptyWorkspace(), [older, newer])
    expect(backwards.workspace.reports).toEqual(r.workspace.reports)
  })
  it('keeps the visits of the same case on different days apart, and of different technicians on one day', () => {
    const r = mergeReports(emptyWorkspace(), [
      file('Asha', D, T1, [done('A1')]), file('Asha', '2026-11-24', T1, [done('A1')]), file('Bo', D, T1, [done('B1')]),
    ])
    expect(r.workspace.reports).toHaveLength(3)
    expect(r.counts.added).toBe(3)
  })
  it('does not change the workspace it was given', () => {
    const w = emptyWorkspace()
    mergeReports(w, [file('Asha', D, T1, [done('A1')])])
    expect(w.reports).toEqual([])
  })
  it('copes with many files at once (300 technicians)', () => {
    const files = Array.from({ length: 300 }, (_, i) => file(`Tech ${i}`, D, T1, Array.from({ length: 8 }, (_, j) => done(`C${i}-${j}`))))
    const r = mergeReports(emptyWorkspace(), files)
    expect(r.counts).toEqual({ files: 300, added: 2400, updated: 0, unchanged: 0, older: 0 })
  })
})

const stored = (id: string, over: Partial<StoredCase> = {}): StoredCase => ({
  caseId: id, workTypeName: 'Service', place: 'North', state: 'active', reportedAt: '2026-10-10', overrides: {},
  firstImported: '2026-10-13', lastImported: '2026-10-13', ...over,
})

describe('daySummary', () => {
  const planned = [
    { caseId: 'A1', technician: 'Asha' }, { caseId: 'A2', technician: 'Asha' }, { caseId: 'B1', technician: 'Bo' },
    { caseId: 'B2', technician: 'Bo' }, { caseId: 'C1', technician: 'Chitra' },
  ]
  const reports = mergeReports(emptyWorkspace(), [
    file('Asha', D, T1, [done('A1'), { caseId: 'A2', status: 'partly', reason: 'part_missing', remarks: 'back Monday' }]),
    file('Bo', D, T1, [{ caseId: 'B1', status: 'not_done', reason: 'customer_absent' }]),
    file('Dev', D, T1, [done('Z9')]),
    file('Asha', '2026-11-24', T1, [done('A7')]),
  ]).workspace.reports

  it('counts the planned visits that are reported, and how they went', () => {
    const s = daySummary(reports, D, planned)
    expect(s).toMatchObject({ planned: 5, reported: 3, done: 1, partly: 1, notDone: 1, unreported: 2 })
  })
  it('lists the visits that were not wholly done, with who, why and what was written', () => {
    const s = daySummary(reports, D, planned)
    expect(s.problems.map((p) => [p.technician, p.caseId, p.status, p.reason, p.remarks])).toEqual([
      ['Asha', 'A2', 'partly', 'part_missing', 'back Monday'],
      ['Bo', 'B1', 'not_done', 'customer_absent', undefined],
    ])
  })
  it('lists the technicians who still have planned visits without a report, most visits first', () => {
    expect(daySummary(reports, D, planned).waiting).toEqual([{ technician: 'Bo', visits: 1 }, { technician: 'Chitra', visits: 1 }])
  })
  it('counts reports for the day that are not for a planned visit, and ignores other days', () => {
    const s = daySummary(reports, D, planned)
    expect(s.other).toBe(1)
    expect(daySummary(reports, '2026-11-24', []).other).toBe(1)
  })
  it('says nothing is reported when no report is for the day', () => {
    expect(daySummary([], D, planned)).toMatchObject({ planned: 5, reported: 0, unreported: 5, problems: [], other: 0 })
  })
})

describe('markReportedDone', () => {
  const base = (): Workspace => ({ ...emptyWorkspace(), cases: [stored('A1'), stored('A2'), stored('A3'), stored('A4', { state: 'done' }), stored('A5', { state: 'closed' })] })
  const withReports = (w: Workspace, visits: Visit[]): Workspace => mergeReports(w, [file('Asha', D, T1, visits)]).workspace

  it('marks the cases that were reported done, and counts them', () => {
    const w = withReports(base(), [done('A1'), { caseId: 'A2', status: 'partly' }, { caseId: 'A3', status: 'not_done' }])
    const r = markReportedDone(w)
    expect(r.marked).toBe(1)
    expect(r.workspace.cases.find((c) => c.caseId === 'A1')).toMatchObject({ state: 'done', overrides: { done: true } })
    expect(r.workspace.cases.find((c) => c.caseId === 'A2')?.state).toBe('active')
    expect(r.workspace.cases.find((c) => c.caseId === 'A3')?.state).toBe('active')
  })
  it('leaves a case that is done or closed already, and a case it does not know', () => {
    const r = markReportedDone(withReports(base(), [done('A4'), done('A5'), done('NOPE')]))
    expect(r.marked).toBe(0)
  })
  it('does the same thing the second time: nothing more to mark', () => {
    const once = markReportedDone(withReports(base(), [done('A1')])).workspace
    expect(markReportedDone(once).marked).toBe(0)
  })
})

describe('clearReports', () => {
  it('removes every report and nothing else', () => {
    const w = { ...mergeReports(emptyWorkspace(), [file('Asha', D, T1, [done('A1')])]).workspace, holidays: ['2026-12-25'] }
    const c = clearReports(w)
    expect(c.reports).toEqual([])
    expect(c.holidays).toEqual(['2026-12-25'])
  })
})

describe('reports in a saved or restored workspace', () => {
  it('read as none in a workspace saved before reports existed', () => {
    const old = { workspaceVersion: 1, site: emptyWorkspace().site, technicians: [], cases: [], profiles: [], changes: [], imports: [], holidays: [] }
    expect(readWorkspace(old).reports).toEqual([])
  })
  it('read again like a file: damaged entries are dropped and nothing extra comes through', () => {
    const good = { caseId: 'A1', status: 'done', date: D, technician: 'Asha', reportedAt: T1, finishedAt: '10:00' }
    const back = readStoredReports([good, { ...good, caseId: 'A2', extra: 'no', customerName: 'Someone' }, { ...good, status: 'bogus' }, { ...good, date: 'x' }, { ...good, caseId: 'A1' }, null, 'x'])
    expect(back.map((r) => r.caseId)).toEqual(['A1', 'A2'])
    expect(JSON.stringify(back)).not.toMatch(/Someone|extra/)
    expect(readStoredReports('nope')).toEqual([])
    expect(readWorkspace({ ...emptyWorkspace(), reports: [good, 5] }).reports).toHaveLength(1)
  })
})
