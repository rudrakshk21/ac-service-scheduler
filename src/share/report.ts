import { t, type MessageKey } from '../i18n'
import { fileSlug } from './routePack'

/**
 * A visit report is one small JSON file for one technician and one route: for each visit, whether it was done, why not,
 * when, and what the technician wrote. It goes back to the planner the way a route pack goes out (by any app that sends
 * files). `parseReport` builds the report again from the fields below only, so nothing else in a file can ride along.
 * The remarks are the technician's own words: the screen warns against customer names and phone numbers, and nothing
 * else in a report is about a customer.
 */
export const STATUSES = ['done', 'partly', 'not_done'] as const
export type Status = (typeof STATUSES)[number]

/** Why a visit was not (or not wholly) done: codes, so that they can be shown in any language. */
export const REASONS = ['customer_absent', 'no_access', 'part_missing', 'no_time', 'other'] as const
export type Reason = (typeof REASONS)[number]

export interface Visit {
  caseId: string
  status: Status
  /** Only for `partly` and `not_done`. */
  reason?: Reason
  /** `HH:MM`, the time of day the visit ended. */
  finishedAt?: string
  remarks?: string
}

export interface ReportFile {
  reportVersion: 1
  site: string
  technician: string
  /** The day of the route, `YYYY-MM-DD`. */
  date: string
  /** When the report was made, an ISO time. A newer report for the same case replaces an older one. */
  createdAt: string
  visits: Visit[]
}

/** Limits: a route has a few dozen visits at most, so a larger file is not a report. */
export const MAX_VISITS = 200
export const MAX_REMARKS = 500
export const MAX_REPORT_CHARS = 256 * 1024

export class ReportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReportError'
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const isStatus = (v: unknown): v is Status => typeof v === 'string' && (STATUSES as readonly string[]).includes(v)
const isReason = (v: unknown): v is Reason => typeof v === 'string' && (REASONS as readonly string[]).includes(v)
/** At most `MAX_REMARKS` characters, counted as people count them (a letter outside the basic range is one). */
const clip = (s: string): string => Array.from(s.trim()).slice(0, MAX_REMARKS).join('')

/** One visit without empty fields, and without a reason when the visit was done. */
export function cleanVisit(v: Visit): Visit {
  const out: Visit = { caseId: v.caseId, status: v.status }
  if (v.status !== 'done' && v.reason !== undefined) out.reason = v.reason
  if (v.finishedAt !== undefined && v.finishedAt !== '') out.finishedAt = v.finishedAt
  const remarks = v.remarks === undefined ? '' : clip(v.remarks)
  if (remarks !== '') out.remarks = remarks
  return out
}

/**
 * The report for a route, from what the technician entered: only visits that are stops of the route, in the order of
 * the stops. `createdAt` is an ISO time.
 */
export function buildReport(
  pack: { site: string; technician: string; date: string; stops: { caseId: string }[] },
  entries: Visit[],
  createdAt: string,
): ReportFile {
  const byCase = new Map(entries.map((e) => [e.caseId, e]))
  const visits = pack.stops.flatMap((s): Visit[] => {
    const e = byCase.get(s.caseId)
    return e === undefined ? [] : [cleanVisit(e)]
  })
  return { reportVersion: 1, site: pack.site, technician: pack.technician, date: pack.date, createdAt, visits }
}

export function serialiseReport(file: ReportFile): string {
  return JSON.stringify(file, null, 2) + '\n'
}

const badVisit = (n: number, problem: MessageKey): ReportError => new ReportError(t('report.err.visit', { n, problem: t(problem) }))

function readVisit(raw: unknown, n: number): Visit {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw badVisit(n, 'report.err.visitNotVisit')
  const v = raw as Record<string, unknown>
  if (!isText(v.caseId)) throw badVisit(n, 'report.err.visitCase')
  if (!isStatus(v.status)) throw badVisit(n, 'report.err.visitStatus')
  const out: Visit = { caseId: v.caseId, status: v.status }
  if (v.reason !== undefined && v.reason !== '') {
    if (!isReason(v.reason)) throw badVisit(n, 'report.err.visitReason')
    if (v.status !== 'done') out.reason = v.reason
  }
  if (v.finishedAt !== undefined && v.finishedAt !== '') {
    if (typeof v.finishedAt !== 'string' || !CLOCK.test(v.finishedAt)) throw badVisit(n, 'report.err.visitTime')
    out.finishedAt = v.finishedAt
  }
  if (v.remarks !== undefined) {
    if (typeof v.remarks !== 'string') throw badVisit(n, 'report.err.visitRemarks')
    const remarks = clip(v.remarks)
    if (remarks !== '') out.remarks = remarks
  }
  return out
}

/**
 * The visits in something stored on the phone: the ones that can be read, once each, up to the limit. A damaged entry is
 * left out instead of stopping the screen.
 */
export function readVisits(raw: unknown): Visit[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: Visit[] = []
  for (const [i, item] of raw.entries()) {
    try {
      const visit = readVisit(item, i + 1)
      if (!seen.has(visit.caseId)) {
        seen.add(visit.caseId)
        out.push(visit)
      }
    } catch {
      // not a visit: left out
    }
  }
  return out.slice(0, MAX_VISITS)
}

/** Reads a visit report. Throws a `ReportError` with a plain message. Fields that are not part of a report are dropped. */
export function parseReport(text: string): ReportFile {
  if (text.length > MAX_REPORT_CHARS) throw new ReportError(t('report.err.tooBig'))
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ReportError(t('report.err.notReport'))
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw) || !('reportVersion' in raw)) throw new ReportError(t('report.err.notReport'))
  const r = raw as Record<string, unknown>
  if (r.reportVersion !== 1) throw new ReportError(t('report.err.version'))
  if (!isText(r.technician)) throw new ReportError(t('report.err.technician'))
  if (typeof r.site !== 'string') throw new ReportError(t('report.err.site'))
  if (typeof r.date !== 'string' || !ISO_DATE.test(r.date)) throw new ReportError(t('report.err.date'))
  if (typeof r.createdAt !== 'string' || Number.isNaN(Date.parse(r.createdAt))) throw new ReportError(t('report.err.createdAt'))
  if (!Array.isArray(r.visits) || r.visits.length === 0) throw new ReportError(t('report.err.noVisits'))
  if (r.visits.length > MAX_VISITS) throw new ReportError(t('report.err.tooMany', { max: MAX_VISITS }))
  const visits = r.visits.map((v, i) => readVisit(v, i + 1))
  if (new Set(visits.map((v) => v.caseId)).size !== visits.length) throw new ReportError(t('report.err.duplicate'))
  return { reportVersion: 1, site: r.site, technician: r.technician, date: r.date, createdAt: r.createdAt, visits }
}

/** `report-asha-k-2026-11-22.json`: letters, digits and dashes only. */
export function reportFileName(file: Pick<ReportFile, 'technician' | 'date'>): string {
  return `report-${fileSlug(file.technician)}-${file.date}.json`
}
