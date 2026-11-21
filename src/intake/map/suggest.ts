import { t } from '../../i18n'
import { detectDateOrder, parseDate } from '../read/dates'
import { detectDecimal } from '../read/numbers'
import type { Cell, SourceTable } from '../read/table'
import { PERSONAL_NAMES, SEED_DICTIONARY } from './dictionary'
import { FIELDS, normaliseName, openName, PERSONAL_FIELDS, type Kind } from './model'
import { fingerprintOf, type MappingProfile } from './profile'

export interface Suggestion {
  field: string
  /** Source column headers, in table order. Several only for fields that may be built from more than one column. */
  columns: string[]
  /** 0 to 1. At 0.8 or more the column is pre-filled in the draft profile. */
  confidence: number
  reason: string
  /** The field usually holds personal data: it stays unmapped until the user chooses. */
  personal: boolean
}

export interface SuggestResult {
  profile: MappingProfile
  suggestions: Suggestion[]
  unmatchedColumns: string[]
  /** Columns that usually hold personal data (phone, email, customer name, address). Never mapped by suggestion. */
  personalColumns: string[]
  /** The day and month of the date columns cannot be told apart: the user confirms the order once. */
  needsDateOrder: boolean
}

interface Candidate {
  field: string
  col: number
  conf: number
  reason: string
}

const PREFILL = 0.8
const MULTI_FIELDS = new Set(['area', 'skills'])
const DATE_FIELDS = ['reportedAt', 'dueAt', 'earliestDate', 'leaveFrom', 'leaveTo']
const NUMBER_FIELDS = [
  'latitude', 'longitude', 'durationMin', 'shiftHours', 'breakMin', 'startLatitude', 'startLongitude', 'endLatitude',
  'endLongitude',
]
const SAMPLE = 100

interface NameSet {
  exact: Set<string>
  tokens: string[][]
}

function nameSet(kind: Kind, field: string, site: { columnNames: Record<string, string[]> } | null): NameSet {
  const raw = [...(SEED_DICTIONARY[kind][field] ?? []), openName(field), field, ...(site?.columnNames[field] ?? [])]
  const exact = new Set(raw.map(normaliseName))
  return { exact, tokens: [...exact].map((n) => n.split(' ')) }
}

/** 1 for a known name; 0.6 to 0.9 when the words of the header contain a known name or the other way round. */
function nameScore(header: string, names: NameSet): number {
  if (names.exact.has(header)) return 1
  const words = header.split(' ')
  let best = 0
  for (const tokens of names.tokens) {
    const shared = tokens.filter((t) => words.includes(t)).length
    if (shared === 0) continue
    if (shared === tokens.length || shared === words.length) {
      best = Math.max(best, 0.6 + 0.3 * (shared / Math.max(tokens.length, words.length)))
    }
  }
  return best
}

function sampleOf(table: SourceTable, col: number): Cell[] {
  const out: Cell[] = []
  for (const row of table.rows) {
    if (row[col] !== null) out.push(row[col])
    if (out.length >= SAMPLE) break
  }
  return out
}

function dateLike(cells: Cell[]): boolean {
  if (cells.length < 2) return false
  const strings = cells.filter((c): c is string => typeof c === 'string')
  const found = detectDateOrder(strings)
  const order = found.order ?? (found.ambiguous ? 'dmy' : null)
  const ok = cells.filter((c) => c instanceof Date || (typeof c === 'string' && parseDate(c, order) !== null)).length
  return ok / cells.length >= 0.6
}

function dateFieldFor(kind: Kind, header: string): string | null {
  const words = new Set(header.split(' '))
  const has = (...w: string[]) => w.some((x) => words.has(x))
  if (kind === 'cases') {
    if (has('due', 'sla', 'target', 'commitment')) return 'dueAt'
    if (has('earliest', 'available', 'before')) return 'earliestDate'
    return 'reportedAt'
  }
  if (kind === 'technicians') {
    if (has('from', 'start')) return 'leaveFrom'
    if (has('to', 'end')) return 'leaveTo'
  }
  return null
}

function idLike(table: SourceTable, col: number): boolean {
  const seen = new Set<string>()
  for (const row of table.rows) {
    const v = row[col]
    if (v === null || typeof v === 'boolean' || v instanceof Date) return false
    const t = String(v)
    if (t.length < 3 || t.length > 20 || seen.has(t)) return false
    seen.add(t)
  }
  return seen.size > 0
}

function lowVariety(table: SourceTable, col: number, cells: Cell[]): boolean {
  const texts = cells.filter((c): c is string => typeof c === 'string')
  if (texts.length < cells.length * 0.9 || dateLike(cells)) return false
  const distinct = new Set(table.rows.map((r) => r[col]).filter((c) => c !== null)).size
  return distinct >= 2 && distinct <= Math.max(12, Math.ceil(table.rows.length * 0.05))
}

/**
 * Suggests a mapping of the table's columns to the common model: by name (seed dictionary, the site's own names, the
 * open-format names) and by what the values look like. Returns a draft profile with every column at 0.8 or more
 * pre-filled, and every suggestion with a confidence and a reason, for the screen to confirm.
 */
export function suggestProfile(
  table: SourceTable,
  kind: Kind,
  site: { columnNames: Record<string, string[]> } | null,
  name?: string,
): SuggestResult {
  const fields = FIELDS[kind]
  const headers = table.headers.map(normaliseName)
  const personalSet = new Set(PERSONAL_NAMES.map(normaliseName))
  const personalCols = new Set<number>()
  if (kind === 'cases') {
    headers.forEach((h, i) => {
      if (personalSet.has(h) || h.split(' ').some((w) => ['phone', 'mobile', 'email'].includes(w))) personalCols.add(i)
    })
  }

  const nameSets = new Map(fields.map((f) => [f, nameSet(kind, f, site)]))
  // A nested JSON column such as `location.lat` is also scored by its last part (`lat`), a little lower.
  const tails = table.headers.map((h) => (h.includes('.') ? normaliseName(h.slice(h.lastIndexOf('.') + 1)) : ''))
  const cands: Candidate[] = []
  const named = new Set<number>()
  headers.forEach((h, col) => {
    if (personalCols.has(col)) return
    for (const field of fields) {
      const names = nameSets.get(field) as NameSet
      const s = Math.max(nameScore(h, names), tails[col] === '' ? 0 : 0.95 * nameScore(tails[col], names))
      if (s >= 0.6) {
        named.add(col)
        cands.push({
          field, col, conf: s,
          reason: t(s === 1 ? 'intake.suggest.known' : 'intake.suggest.resembles', { header: table.headers[col], field }),
        })
      }
    }
  })
  headers.forEach((h, col) => {
    if (personalCols.has(col) || named.has(col)) return
    const cells = sampleOf(table, col)
    if (dateLike(cells)) {
      const field = dateFieldFor(kind, h)
      if (field !== null && fields.includes(field)) {
        cands.push({ field, col, conf: 0.55, reason: t('intake.suggest.dates', { header: table.headers[col] }) })
        return
      }
    }
    if (kind === 'cases' && idLike(table, col)) {
      cands.push({ field: 'caseId', col, conf: 0.5, reason: t('intake.suggest.unique', { header: table.headers[col] }) })
    } else if (kind === 'cases' && lowVariety(table, col, cells)) {
      cands.push({ field: 'workType', col, conf: 0.4, reason: t('intake.suggest.category', { header: table.headers[col] }) })
    }
  })

  const order = (f: string) => fields.indexOf(f)
  cands.sort((a, b) => b.conf - a.conf || order(a.field) - order(b.field) || a.col - b.col)
  const used = new Set<number>()
  const chosen = new Map<string, Candidate[]>()
  for (const c of cands) {
    if (used.has(c.col)) continue
    const have = chosen.get(c.field)
    if (have !== undefined && !(MULTI_FIELDS.has(c.field) && c.conf >= PREFILL && have[0].conf >= PREFILL)) continue
    used.add(c.col)
    chosen.set(c.field, [...(have ?? []), c])
  }

  const suggestions: Suggestion[] = []
  for (const field of fields) {
    const list = chosen.get(field)
    if (list === undefined) continue
    const byCol = [...list].sort((a, b) => a.col - b.col)
    suggestions.push({
      field,
      columns: byCol.map((c) => table.headers[c.col]),
      confidence: list[0].conf,
      reason: list[0].reason,
      personal: PERSONAL_FIELDS.includes(field),
    })
  }

  const columns: Record<string, string[]> = {}
  for (const s of suggestions) if (s.confidence >= PREFILL && !s.personal) columns[s.field] = s.columns

  const formats: MappingProfile['formats'] = {}
  if (table.format !== 'xlsx') formats.encoding = table.detected.encoding
  if (table.detected.delimiter !== null) formats.delimiter = table.detected.delimiter
  const valuesOf = (fieldList: string[]): string[] => {
    const out: string[] = []
    for (const f of fieldList) {
      for (const header of columns[f] ?? []) {
        const col = table.headers.indexOf(header)
        for (const row of table.rows) if (typeof row[col] === 'string') out.push(row[col] as string)
      }
    }
    return out
  }
  const dates = detectDateOrder(valuesOf(DATE_FIELDS))
  if (dates.order !== null) formats.dateOrder = dates.order
  const decimal = detectDecimal(valuesOf(NUMBER_FIELDS))
  if (decimal !== null) formats.decimal = decimal

  const profile: MappingProfile = {
    profileVersion: 1,
    name: name ?? table.fileName,
    kind,
    fingerprint: fingerprintOf(table.headers),
    ...(table.format === 'xlsx' ? { sheet: table.sheet } : {}),
    headerRow: table.headerRow,
    formats,
    columns,
    valueMaps: { workType: {}, status: {}, priority: {}, skill: {} },
  }
  const unmatchedColumns = table.headers.filter((_, i) => !used.has(i) && !personalCols.has(i))
  const personalColumns = [
    ...table.headers.filter((_, i) => personalCols.has(i)),
    ...suggestions.filter((s) => s.personal).flatMap((s) => s.columns),
  ]
  return { profile, suggestions, unmatchedColumns, personalColumns, needsDateOrder: dates.ambiguous }
}
