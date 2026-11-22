import type { ReportFile } from '../share/report'
import type { StoredCase } from '../intake/import/merge'
import { reportKey, type StoredReport } from './reportRecords'
import type { Workspace } from './workspace'

export interface MergeCounts {
  /** Files read. */
  files: number
  /** Visits that are new. */
  added: number
  /** Visits that replaced an older report of the same case and day. */
  updated: number
  /** Visits already known, the same. */
  unchanged: number
  /** Visits from a file older than the report already kept: left out. */
  older: number
}

const same = (a: StoredReport, b: StoredReport): boolean =>
  a.status === b.status && a.reason === b.reason && a.finishedAt === b.finishedAt && a.remarks === b.remarks && a.technician === b.technician

/**
 * The workspace with the visits of some report files added. A case and day has one record: when a second report comes for
 * it, the one made later wins, whatever order the files are opened in; the same report twice changes nothing. The
 * workspace it was given is not changed.
 */
export function mergeReports(w: Workspace, files: ReportFile[]): { workspace: Workspace; counts: MergeCounts } {
  const list = [...w.reports]
  const at = new Map(list.map((r, i) => [reportKey(r.caseId, r.date), i]))
  const counts: MergeCounts = { files: files.length, added: 0, updated: 0, unchanged: 0, older: 0 }
  for (const file of files) {
    for (const visit of file.visits) {
      const record: StoredReport = { ...visit, date: file.date, technician: file.technician, reportedAt: file.createdAt }
      const key = reportKey(record.caseId, record.date)
      const index = at.get(key)
      if (index === undefined) {
        at.set(key, list.length)
        list.push(record)
        counts.added += 1
      } else if (same(list[index], record)) {
        counts.unchanged += 1
      } else if (Date.parse(list[index].reportedAt) > Date.parse(record.reportedAt)) {
        counts.older += 1
      } else {
        list[index] = record
        counts.updated += 1
      }
    }
  }
  return { workspace: { ...w, reports: list }, counts }
}

export interface DaySummary {
  /** Visits planned for the day. */
  planned: number
  /** Planned visits that have a report. */
  reported: number
  done: number
  partly: number
  notDone: number
  /** Planned visits with no report yet. */
  unreported: number
  /** Every report of the day that was not wholly done, by technician and case. */
  problems: StoredReport[]
  /** Technicians with planned visits that are not reported, those with most first. */
  waiting: { technician: string; visits: number }[]
  /** Reports for the day for a case that is not among the planned visits. */
  other: number
}

/** How the reports stand against the plan of one day (`date` is `YYYY-MM-DD`; `planned` are the day's planned visits). */
export function daySummary(reports: StoredReport[], date: string, planned: { caseId: string; technician: string }[]): DaySummary {
  const day = reports.filter((r) => r.date === date)
  const byCase = new Map(day.map((r) => [r.caseId, r]))
  const plannedIds = new Set(planned.map((p) => p.caseId))
  const summary: DaySummary = { planned: planned.length, reported: 0, done: 0, partly: 0, notDone: 0, unreported: 0, problems: [], waiting: [], other: 0 }
  const waiting = new Map<string, number>()
  for (const p of planned) {
    const r = byCase.get(p.caseId)
    if (r === undefined) {
      summary.unreported += 1
      waiting.set(p.technician, (waiting.get(p.technician) ?? 0) + 1)
      continue
    }
    summary.reported += 1
    if (r.status === 'done') summary.done += 1
    else if (r.status === 'partly') summary.partly += 1
    else summary.notDone += 1
  }
  summary.other = day.filter((r) => !plannedIds.has(r.caseId)).length
  summary.problems = day.filter((r) => r.status !== 'done').sort((a, b) => a.technician.localeCompare(b.technician) || a.caseId.localeCompare(b.caseId))
  summary.waiting = [...waiting].map(([technician, visits]) => ({ technician, visits })).sort((a, b) => b.visits - a.visits || a.technician.localeCompare(b.technician))
  return summary
}

/**
 * Marks as done every active case that a report says was done, so that the next plan does not visit it again. A case that
 * is done or closed already, or that is not in the workspace, is left alone. Partly done and not done stay in the plan.
 */
export function markReportedDone(w: Workspace): { workspace: Workspace; marked: number } {
  const doneIds = new Set(w.reports.filter((r) => r.status === 'done').map((r) => r.caseId))
  let marked = 0
  const cases = w.cases.map((c): StoredCase => {
    if (c.state !== 'active' || !doneIds.has(c.caseId)) return c
    marked += 1
    return { ...c, state: 'done', overrides: { ...c.overrides, done: true } }
  })
  return { workspace: marked === 0 ? w : { ...w, cases }, marked }
}

/** The workspace without any report. */
export function clearReports(w: Workspace): Workspace {
  return { ...w, reports: [] }
}
