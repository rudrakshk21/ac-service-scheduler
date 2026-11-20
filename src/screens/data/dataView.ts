import type { StoredCase, StoredState } from '../../intake/import/merge'
import type { ImportedTechnician } from '../../intake/map/apply'
import { normaliseName } from '../../intake/map/model'
import type { WorkType } from '../../engine/types'

export const STATE_ORDER: StoredState[] = ['active', 'hold', 'review', 'ignored', 'done', 'closed']

const LABELS: Record<StoredState, string> = {
  active: 'Ready to plan', hold: 'On hold', review: 'Needs review', ignored: 'Ignored', done: 'Done', closed: 'Closed',
}

export const stateLabel = (s: StoredState): string => LABELS[s]

export function countsByState(cases: StoredCase[]): Record<StoredState, number> {
  const out: Record<StoredState, number> = { active: 0, hold: 0, review: 0, ignored: 0, done: 0, closed: 0 }
  for (const c of cases) out[c.state] += 1
  return out
}

/** Cases of one state (or all), whose identifier, work type, place, status or notes contain every word of the query. */
export function filterCases(cases: StoredCase[], f: { state: StoredState | 'all'; query: string }): StoredCase[] {
  const words = normaliseName(f.query).split(' ').filter((w) => w !== '')
  return cases.filter((c) => {
    if (f.state !== 'all' && c.state !== f.state) return false
    if (words.length === 0) return true
    const hay = normaliseName([c.caseId, c.workTypeName, c.workType, c.place, c.area, c.status, c.notes].filter((x) => x !== undefined).join(' '))
    return words.every((w) => hay.includes(w))
  })
}

export interface QueueItem {
  caseId: string
  issue: 'no_location' | 'review'
  detail: string
}

/** Cases that cannot be planned yet: no place found, or a category that is not matched to a work type. */
export function exceptionQueue(cases: StoredCase[]): QueueItem[] {
  const out: QueueItem[] = []
  for (const c of cases) {
    if (c.state === 'review') out.push({ caseId: c.caseId, issue: 'review', detail: `The category “${c.workType ?? 'empty'}” is not matched to a work type.` })
    if (c.place === undefined && c.state !== 'closed' && c.state !== 'ignored' && c.state !== 'done') {
      const given = [c.area, c.postalCode, c.address].filter((x) => x !== undefined).join(' / ')
      out.push({ caseId: c.caseId, issue: 'no_location', detail: given === '' ? 'The file gave no place.' : `The place (${given}) is not in your place table.` })
    }
  }
  return out
}

/** Index of a work type in the site's list, to colour it the same way everywhere. -1 when unknown. */
export function workTypeIndex(name: string | undefined, workTypes: readonly WorkType[]): number {
  return name === undefined ? -1 : workTypes.findIndex((w) => w.name === name)
}

export interface TechnicianRow {
  name: string
  skills: string
  status: string
  leave: string
}

export function techniciansView(list: ImportedTechnician[]): TechnicianRow[] {
  return list.map((t) => ({
    name: t.name,
    skills: t.skills.length === 0 ? 'No skills matched' : t.skills.join(', '),
    status: t.active ? 'Active' : 'Switched off',
    leave: t.leaveFrom === undefined ? '' : t.leaveTo === undefined || t.leaveTo === t.leaveFrom ? `Leave ${t.leaveFrom}` : `Leave ${t.leaveFrom} to ${t.leaveTo}`,
  }))
}
