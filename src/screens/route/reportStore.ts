import { cleanVisit, readVisits, type Visit } from '../../share/report'
import type { KeyValueStore } from '../../workspace/db'

/** What a technician has entered for one route, kept on the phone until it is sent (and after, in case it is sent again). */
export interface Draft {
  technician: string
  /** The day of the route, `YYYY-MM-DD`. */
  date: string
  visits: Visit[]
  /** An ISO time: when the report was last made into a file. Cleared when a visit changes after that. */
  sentAt?: string
}

/** A phone keeps this many routes' drafts; the oldest go first. */
export const MAX_DRAFTS = 20

const KEY = 'reports'
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const same = (d: Draft, technician: string, date: string): boolean => d.technician === technician && d.date === date

/** What has been entered for a route, in the order it was first entered. */
export function draftVisits(list: Draft[], technician: string, date: string): Visit[] {
  return list.find((d) => same(d, technician, date))?.visits ?? []
}

/** When the report of a route was last made into a file, or undefined: never, or a visit has changed since. */
export function sentAt(list: Draft[], technician: string, date: string): string | undefined {
  return list.find((d) => same(d, technician, date))?.sentAt
}

/** The list with a visit entered (or entered again) for a route. The touched route moves to the front; at most 20 are kept. */
export function reportVisit(list: Draft[], technician: string, date: string, visit: Visit): Draft[] {
  const clean = cleanVisit(visit)
  const old = list.find((d) => same(d, technician, date))
  const known = old?.visits ?? []
  const visits = known.some((x) => x.caseId === clean.caseId) ? known.map((x) => (x.caseId === clean.caseId ? clean : x)) : [...known, clean]
  return [{ technician, date, visits }, ...list.filter((d) => !same(d, technician, date))].slice(0, MAX_DRAFTS)
}

/** The list without the entry of one visit; a route with no entries left is dropped. */
export function forgetVisit(list: Draft[], technician: string, date: string, caseId: string): Draft[] {
  return list.flatMap((d): Draft[] => {
    if (!same(d, technician, date)) return [d]
    const visits = d.visits.filter((x) => x.caseId !== caseId)
    return visits.length === 0 ? [] : [{ technician, date, visits }]
  })
}

/** The list without everything entered for a route (used when the route itself is removed from the phone). */
export function dropDraft(list: Draft[], technician: string, date: string): Draft[] {
  return list.filter((d) => !same(d, technician, date))
}

/** The list with the time a route's report was made into a file. */
export function markSent(list: Draft[], technician: string, date: string, at: string): Draft[] {
  return list.map((d) => (same(d, technician, date) ? { ...d, sentAt: at } : d))
}

/** The saved drafts. Each is read again like a file: a damaged one is dropped and nothing extra comes through. */
export async function loadDrafts(store: KeyValueStore): Promise<Draft[]> {
  const raw = await store.get(KEY)
  if (!Array.isArray(raw)) return []
  const drafts: Draft[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const d = item as Record<string, unknown>
    if (typeof d.technician !== 'string' || d.technician.trim() === '' || typeof d.date !== 'string' || !ISO_DATE.test(d.date)) continue
    const visits = readVisits(d.visits)
    if (visits.length === 0) continue
    const draft: Draft = { technician: d.technician, date: d.date, visits }
    if (typeof d.sentAt === 'string' && !Number.isNaN(Date.parse(d.sentAt))) draft.sentAt = d.sentAt
    drafts.push(draft)
  }
  return drafts.slice(0, MAX_DRAFTS)
}

export async function saveDrafts(store: KeyValueStore, list: Draft[]): Promise<void> {
  await store.set(KEY, list)
}

/** Removes every saved draft. */
export async function clearDrafts(store: KeyValueStore): Promise<void> {
  await store.delete(KEY)
}
