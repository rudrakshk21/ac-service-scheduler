import type { CaseState, Imported, ImportedCase } from '../map/apply'

export type StoredState = CaseState | 'done' | 'closed'

/** Decisions the user made on a case. They survive every later import. */
export interface Overrides {
  technician?: string
  date?: string
  workType?: string
  done?: boolean
}

export interface StoredCase extends Omit<ImportedCase, 'state'> {
  state: StoredState
  overrides: Overrides
  firstImported: string
  lastImported: string
  /** `YYYY-MM-DD`: the first day the app saw the case finished (done or closed). Only kept while a retention period is set. */
  closedAt?: string
}

export interface ImportPreview {
  new: number
  updated: number
  unchanged: number
  duplicate: number
  /** Rows without a usable identifier. */
  incomplete: number
  /** Cases that are no longer in a full export (they become closed). */
  removed: number
}

export interface ChangeLogEntry {
  caseId: string
  field: string
  previous: string
  next: string
  reason: string
}

export interface MergeResult {
  cases: StoredCase[]
  preview: ImportPreview
  changes: ChangeLogEntry[]
}

/** Fields compared between imports. The customer name is carried along but never written to a change log. */
const TRACKED = [
  'workType', 'latitude', 'longitude', 'postalCode', 'area', 'address', 'status', 'reportedAt', 'priority', 'dueAt',
  'productType', 'durationMin', 'earliestDate', 'technician', 'notes', 'otherRef', 'place', 'workTypeName', 'priorityLevel',
] as const

const show = (v: unknown): string => (v === undefined || v === null ? '' : String(v))

function incoming(inc: ImportedCase, overrides: Overrides, previous?: StoredState): StoredState {
  if (overrides.done === true || previous === 'done') return 'done'
  if (inc.state === 'review' && overrides.workType !== undefined) return 'active'
  return inc.state
}

/**
 * Merges a new import into the stored cases. A repeat import updates a case by its identifier and never adds a second
 * one. With a full export, a case that is missing becomes closed. The user's decisions (manual technician or date, a
 * work type chosen for a review case, "done") survive. Nothing is stored and the inputs are not changed.
 */
export function mergeImport(
  existing: StoredCase[], imported: Imported, importDate: string, options: { fullExport?: boolean } = {},
): MergeResult {
  const fullExport = options.fullExport ?? true
  const preview: ImportPreview = { new: 0, updated: 0, unchanged: 0, duplicate: 0, incomplete: 0, removed: 0 }
  const changes: ChangeLogEntry[] = []
  for (const e of imported.exceptions) {
    if (e.issue === 'duplicate_id') preview.duplicate += 1
    if (e.issue === 'missing_id') preview.incomplete += 1
  }
  const byId = new Map(imported.cases.map((c) => [c.caseId, c]))
  const known = new Set(existing.map((c) => c.caseId))
  const cases: StoredCase[] = []

  for (const stored of existing) {
    const inc = byId.get(stored.caseId)
    if (inc === undefined) {
      if (fullExport && stored.state !== 'closed' && stored.state !== 'done') {
        preview.removed += 1
        changes.push({ caseId: stored.caseId, field: 'state', previous: stored.state, next: 'closed', reason: 'missing from import' })
        cases.push({ ...stored, state: 'closed' })
      } else {
        cases.push({ ...stored })
      }
      continue
    }
    const overrides = { ...stored.overrides }
    const next: StoredCase = {
      ...inc,
      workTypeName: inc.workTypeName ?? overrides.workType,
      state: incoming(inc, overrides, stored.state),
      overrides,
      firstImported: stored.firstImported,
      lastImported: importDate,
    }
    if (next.workTypeName === undefined) delete next.workTypeName
    let changed = false
    for (const f of TRACKED) {
      if (show(stored[f]) !== show(next[f])) {
        changed = true
        changes.push({ caseId: stored.caseId, field: f, previous: show(stored[f]), next: show(next[f]), reason: 'import' })
      }
    }
    if (stored.state !== next.state) {
      changed = true
      changes.push({
        caseId: stored.caseId, field: 'state', previous: stored.state, next: next.state,
        reason: stored.state === 'closed' ? 'reappeared in import' : 'import',
      })
    }
    if (changed) preview.updated += 1
    else preview.unchanged += 1
    cases.push(next)
  }

  for (const inc of imported.cases) {
    if (known.has(inc.caseId)) continue
    preview.new += 1
    cases.push({ ...inc, state: incoming(inc, {}), overrides: {}, firstImported: importDate, lastImported: importDate })
  }
  return { cases, preview, changes }
}
