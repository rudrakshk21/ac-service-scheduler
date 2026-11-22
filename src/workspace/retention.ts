import { dayNumber } from '../engine/calendar'
import type { StoredCase } from '../intake/import/merge'
import type { Workspace } from './workspace'

/** How long finished work can be kept, in days. No setting means: until the person deletes it. */
export const RETENTION_CHOICES = [30, 90, 180, 365] as const
export type RetentionDays = (typeof RETENTION_CHOICES)[number]

export const isRetentionDays = (v: unknown): v is RetentionDays => RETENTION_CHOICES.some((c) => c === v)

/** What a pass removed. */
export interface Removed {
  cases: number
  reports: number
  changes: number
}

export interface Tidied {
  workspace: Workspace
  removed: Removed
}

const NOTHING: Removed = { cases: 0, reports: 0, changes: 0 }
export const anyRemoved = (r: Removed): boolean => r.cases + r.reports + r.changes > 0

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar day written `YYYY-MM-DD`; `2026-13-45` and anything with a time are not. */
function isDay(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO_DATE.test(v)) return false
  const at = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === v
}

const isFinished = (c: StoredCase): boolean => c.state === 'done' || c.state === 'closed'
const daysBetween = (from: string, to: string): number => dayNumber(to) - dayNumber(from)

function withoutStamp(c: StoredCase): StoredCase {
  const copy = { ...c }
  delete copy.closedAt
  return copy
}

/**
 * Keeps to the period the person chose (and does nothing when none is chosen). A finished case (done, or no longer in the
 * export) is stamped with the first day it is seen finished and removed more than the period after that day; a reported
 * visit is removed when its day is more than the period ago; the change-log lines of a removed case go with it. The stamp
 * is taken off a case that is no longer finished. When nothing changes, the same workspace comes back.
 */
export function applyRetention(w: Workspace, today: string): Tidied {
  const days = w.retentionDays
  if (days === undefined) return { workspace: w, removed: NOTHING }

  let changed = false
  const gone = new Set<string>()
  const cases: StoredCase[] = []
  for (const c of w.cases) {
    if (!isFinished(c)) {
      if (c.closedAt !== undefined) {
        cases.push(withoutStamp(c))
        changed = true
      } else cases.push(c)
      continue
    }
    if (!isDay(c.closedAt)) {
      cases.push({ ...c, closedAt: today })
      changed = true
    } else if (daysBetween(c.closedAt, today) > days) {
      gone.add(c.caseId)
      changed = true
    } else cases.push(c)
  }

  const reports = w.reports.filter((r) => daysBetween(r.date, today) <= days)
  const changes = gone.size === 0 ? w.changes : w.changes.filter((x) => !gone.has(x.caseId))
  const removed: Removed = { cases: gone.size, reports: w.reports.length - reports.length, changes: w.changes.length - changes.length }
  if (!changed && !anyRemoved(removed)) return { workspace: w, removed: NOTHING }
  return { workspace: { ...w, cases, reports, changes }, removed }
}

/** Switches a period on, changes it, or (undefined) switches it off. Off removes the setting and every stamp, and nothing else. */
export function setRetention(w: Workspace, days: RetentionDays | undefined, today: string): Tidied {
  if (days === undefined) {
    if (w.retentionDays === undefined && !w.cases.some((c) => c.closedAt !== undefined)) return { workspace: w, removed: NOTHING }
    const off: Workspace = { ...w, cases: w.cases.map((c) => (c.closedAt === undefined ? c : withoutStamp(c))) }
    delete off.retentionDays
    return { workspace: off, removed: NOTHING }
  }
  return applyRetention({ ...w, retentionDays: days }, today)
}

/** What choosing a period would do right now: what it removes, and how many finished cases it keeps (their clock runs on). */
export function previewRetention(w: Workspace, days: RetentionDays, today: string): { removeNow: Removed; finishedKept: number } {
  const { workspace, removed } = setRetention(w, days, today)
  return { removeNow: removed, finishedKept: workspace.cases.filter(isFinished).length }
}
