import { readVisits, type Visit } from '../share/report'

/**
 * A visit as the planner keeps it: what the technician reported, and for which day, by whom, and when the report was
 * made. One record for each case and day: a newer report replaces an older one.
 */
export interface StoredReport extends Visit {
  /** The day of the route, `YYYY-MM-DD`. */
  date: string
  technician: string
  /** The `createdAt` of the file the record came from, an ISO time. */
  reportedAt: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** The record of one case on one day. */
export const reportKey = (caseId: string, date: string): string => `${caseId}|${date}`

/**
 * The records in something saved or restored. Each one is read again like a file: a damaged one is dropped, a case and
 * day that appears twice keeps its first record, and a field that is not part of a record does not come through.
 */
export function readStoredReports(raw: unknown): StoredReport[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: StoredReport[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const r = item as Record<string, unknown>
    if (typeof r.technician !== 'string' || r.technician.trim() === '') continue
    if (typeof r.date !== 'string' || !ISO_DATE.test(r.date)) continue
    if (typeof r.reportedAt !== 'string' || Number.isNaN(Date.parse(r.reportedAt))) continue
    const [visit] = readVisits([r])
    if (visit === undefined) continue
    const key = reportKey(visit.caseId, r.date)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...visit, date: r.date, technician: r.technician, reportedAt: r.reportedAt })
  }
  return out
}
