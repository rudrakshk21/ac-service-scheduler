export type ValueField = 'workType' | 'status' | 'priority' | 'skill'

export interface QualityReport {
  rowsRead: number
  blankRowsSkipped: number
  /** Rows such as "Total" at the bottom of a sheet. */
  totalRowsSkipped: number
  raggedRows: number
  /** Field to the share (0 to 1) of imported rows that have a value. */
  filled: Record<string, number>
  duplicates: number
  badDates: { field: string; count: number; examples: string[] }[]
  unknownValues: { field: ValueField; values: string[] }[]
  unresolvedPlaces: number
}

/** Collects the numbers of a quality report while rows are read. */
export interface Tally {
  kept: number
  filled: Map<string, number>
  badDates: Map<string, { count: number; examples: string[] }>
  unknown: Map<ValueField, Set<string>>
}

export function newTally(): Tally {
  return { kept: 0, filled: new Map(), badDates: new Map(), unknown: new Map() }
}

export function markFilled(t: Tally, field: string): void {
  t.filled.set(field, (t.filled.get(field) ?? 0) + 1)
}

export function markBadDate(t: Tally, field: string, value: string): void {
  const e = t.badDates.get(field) ?? { count: 0, examples: [] }
  e.count += 1
  if (e.examples.length < 3 && !e.examples.includes(value)) e.examples.push(value)
  t.badDates.set(field, e)
}

export function markUnknown(t: Tally, field: ValueField, value: string): void {
  const s = t.unknown.get(field) ?? new Set<string>()
  s.add(value)
  t.unknown.set(field, s)
}

const FIELD_ORDER: ValueField[] = ['workType', 'status', 'priority', 'skill']

export function finishQuality(
  t: Tally,
  base: { rowsRead: number; blank: number; total: number; ragged: number; duplicates: number; unresolved: number },
  mappedFields: string[],
): QualityReport {
  const filled: Record<string, number> = {}
  for (const f of mappedFields) filled[f] = t.kept === 0 ? 0 : (t.filled.get(f) ?? 0) / t.kept
  return {
    rowsRead: base.rowsRead,
    blankRowsSkipped: base.blank,
    totalRowsSkipped: base.total,
    raggedRows: base.ragged,
    filled,
    duplicates: base.duplicates,
    badDates: [...t.badDates].map(([field, e]) => ({ field, count: e.count, examples: e.examples })),
    unknownValues: FIELD_ORDER.filter((f) => t.unknown.has(f)).map((field) => ({ field, values: [...(t.unknown.get(field) ?? [])] })),
    unresolvedPlaces: base.unresolved,
  }
}
