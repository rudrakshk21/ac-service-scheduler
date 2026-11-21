import { formatDate, t, tn, tOptional, type MessageKey } from '../../i18n'
import { isOpenFormat } from '../../intake/open-format'
import { FIELDS, MANDATORY, normaliseName, PERSONAL_FIELDS, RECOMMENDED, type Kind, type StatusAction } from '../../intake/map/model'
import type { MappingProfile } from '../../intake/map/profile'
import { suggestProfile, type SuggestResult, type Suggestion } from '../../intake/map/suggest'
import { splitList } from '../../intake/map/values'
import type { Cell, SourceTable } from '../../intake/read/table'
import type { SiteProfile } from '../../intake/site/site'

export type Step = 'file' | 'columns' | 'values' | 'check' | 'done'
export type ValueField = 'workType' | 'status' | 'priority' | 'skill'
export type Level = 'required' | 'recommended' | 'optional'

/** What a kind of file is called: "Service cases", "Technicians", "Places". */
export const kindLabel = (kind: Kind): string => t(`kind.${kind}`)

/** The plain name of a field of a kind, in the language in use. A field nobody wrote a name for is shown by its code. */
export const labelOf = (kind: Kind, field: string): string => tOptional(`field.${kind}.${field}`) ?? field

const LOCATION = ['latitude', 'longitude', 'postalCode', 'area', 'address']

export function levelOf(kind: Kind, field: string): Level {
  if (MANDATORY[kind].includes(field)) return 'required'
  if (RECOMMENDED[kind].includes(field) || (kind === 'cases' && LOCATION.includes(field))) return 'recommended'
  return 'optional'
}

/** What a file most likely holds, from how well its columns match each kind's mandatory fields. Cases when unclear. */
export function guessKind(table: SourceTable, site: SiteProfile): Kind {
  const kinds: Kind[] = ['cases', 'technicians', 'places']
  for (const k of kinds) if (isOpenFormat(table.headers, k) && k !== 'cases') return k
  let best: Kind = 'cases'
  let bestRatio = -1
  for (const kind of kinds) {
    const found = new Map(suggestProfile(table, kind, site).suggestions.filter((s) => s.confidence >= 0.8 && !s.personal).map((s) => [s.field, true]))
    const needed = [...MANDATORY[kind]]
    let hits = needed.filter((f) => found.has(f)).length
    let total = needed.length
    if (kind === 'cases') {
      total += 1
      if (LOCATION.some((f) => found.has(f))) hits += 1
    }
    const ratio = hits / total
    if (ratio > bestRatio) {
      best = kind
      bestRatio = ratio
    }
  }
  return best
}

const DELIMITER_KEYS: Record<string, MessageKey> = { ',': 'delim.name.comma', ';': 'delim.name.semicolon', '	': 'delim.name.tab', '|': 'delim.name.bar' }
const ENCODING_KEYS: Record<string, MessageKey> = {
  'utf-8': 'enc.utf8', 'utf-16le': 'enc.utf16', 'utf-16be': 'enc.utf16', 'windows-1252': 'enc.windows1252',
}

/** One plain sentence about what was found in a file: format, encoding, delimiter, header row, row count. */
export function describeTable(table: SourceTable): string {
  const rows = tn('import.rows', table.rows.length)
  const row = table.headerRow + 1
  if (table.format === 'xlsx') return t('import.describe.xlsx', { sheet: table.sheet, row, rows })
  if (table.format === 'json') return t('import.describe.json', { rows })
  const encKey = ENCODING_KEYS[table.detected.encoding]
  const encoding = encKey === undefined ? table.detected.encoding : t(encKey)
  const found = table.detected.delimiter
  const delimiter = found === null ? '' : t('import.describe.delimiter', { name: DELIMITER_KEYS[found] === undefined ? found : t(DELIMITER_KEYS[found]) })
  return t('import.describe.csv', { encoding, delimiter, row, rows })
}

/** The two ways a date such as 04/05/2026 can be read, written out so the user can pick one. */
export function dateReadings(value: string): { dmy: string; mdy: string } | null {
  const parts = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})/.exec(value.trim())
  if (parts === null) return null
  const a = Number(parts[1])
  const b = Number(parts[2])
  const y = parts[3].length === 2 ? 2000 + Number(parts[3]) : Number(parts[3])
  if (a > 12 || b > 12 || a === 0 || b === 0) return null
  const show = (month: number, day: number): string =>
    formatDate(new Date(Date.UTC(y, month - 1, day)), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  return { dmy: show(b, a), mdy: show(a, b) }
}

const text = (c: Cell): string | null => (c === null ? null : c instanceof Date ? c.toISOString().slice(0, 10) : String(c))

export function sampleValues(table: SourceTable, header: string, n = 3): string[] {
  const col = table.headers.indexOf(header)
  if (col < 0) return []
  const out: string[] = []
  for (const row of table.rows) {
    const value = text(row[col])
    if (value !== null && !out.includes(value)) out.push(value)
    if (out.length >= n) break
  }
  return out
}

export interface FieldRow {
  field: string
  label: string
  level: Level
  personal: boolean
  suggestion: Suggestion | null
  /** Source columns now chosen for the field. */
  chosen: string[]
  /** A few sample values of each chosen column. */
  samples: string[][]
}

const ORDER: Level[] = ['required', 'recommended', 'optional']

/** One row per field of the kind: needed fields first, then helpful ones, then optional ones. */
export function fieldRows(kind: Kind, table: SourceTable, result: SuggestResult, profile: MappingProfile): FieldRow[] {
  const rows = FIELDS[kind].map((field): FieldRow => {
    const chosen = profile.columns[field] ?? []
    return {
      field, label: labelOf(kind, field), level: levelOf(kind, field), personal: PERSONAL_FIELDS.includes(field),
      suggestion: result.suggestions.find((s) => s.field === field) ?? null, chosen, samples: chosen.map((h) => sampleValues(table, h)),
    }
  })
  return ORDER.flatMap((level) => rows.filter((r) => r.level === level))
}

export function setColumns(profile: MappingProfile, field: string, headers: string[]): MappingProfile {
  const columns = { ...profile.columns }
  if (headers.length === 0) delete columns[field]
  else columns[field] = [...headers]
  return { ...profile, columns }
}

const COLUMN_OF: Record<ValueField, string> = { workType: 'workType', status: 'status', priority: 'priority', skill: 'skills' }

/** The value fields a kind can map, as far as their column is chosen. */
export function valueFields(kind: Kind, profile: MappingProfile): ValueField[] {
  const all: ValueField[] = kind === 'cases' ? ['workType', 'status', 'priority'] : kind === 'technicians' ? ['skill'] : []
  return all.filter((f) => (profile.columns[COLUMN_OF[f]] ?? []).length > 0)
}

export interface ValueRow {
  /** The spelling of the first row that had it. */
  source: string
  count: number
  /** The site option it maps to (a work type, level or skill name, or an action); null when not matched yet. */
  target: string | null
}

const own = (names: readonly string[], key: string): string | undefined => names.find((n) => normaliseName(n) === key)

/** Distinct values of a mapped column with how many rows have each and where each one goes now. */
export function valueRows(table: SourceTable, profile: MappingProfile, site: SiteProfile, field: ValueField): ValueRow[] {
  const cols = (profile.columns[COLUMN_OF[field]] ?? []).map((h) => table.headers.indexOf(h)).filter((i) => i >= 0)
  const seen = new Map<string, ValueRow>()
  for (const row of table.rows) {
    for (const col of cols) {
      const value = text(row[col])
      if (value === null) continue
      for (const piece of field === 'skill' ? splitList(value) : [value.trim()]) {
        if (piece === '') continue
        const key = normaliseName(piece)
        const have = seen.get(key)
        if (have !== undefined) have.count += 1
        else seen.set(key, { source: piece, count: 1, target: targetOf(profile, site, field, key) })
      }
    }
  }
  return [...seen.values()].sort((a, b) => b.count - a.count || a.source.localeCompare(b.source)).slice(0, 200)
}

function targetOf(profile: MappingProfile, site: SiteProfile, field: ValueField, key: string): string | null {
  const mapped = profile.valueMaps[field][key]
  if (mapped !== undefined) return mapped
  if (field === 'workType') return own(site.workTypes.map((w) => w.name), key) ?? null
  if (field === 'priority') return own(site.priorityLevels.map((l) => l.name), key) ?? null
  if (field === 'skill') return own(site.skills, key) ?? null
  return null
}

export function valueOptions(site: SiteProfile, field: ValueField): { value: string; label: string }[] {
  if (field === 'status') {
    return [
      { value: 'schedule', label: t('import.option.plan') },
      { value: 'hold', label: t('import.option.hold') },
      { value: 'ignore', label: t('import.option.ignore') },
    ]
  }
  const names = field === 'workType' ? site.workTypes.map((w) => w.name) : field === 'priority' ? site.priorityLevels.map((l) => l.name) : site.skills
  return names.map((n) => ({ value: n, label: n }))
}

/** Sets or clears where a source value goes. Keys are normalised the way the library reads them. */
export function setValue(profile: MappingProfile, field: ValueField, source: string, target: string | null): MappingProfile {
  const key = normaliseName(source)
  const map: Record<string, string> = { ...profile.valueMaps[field] }
  if (target === null) delete map[key]
  else map[key] = target
  return { ...profile, valueMaps: { ...profile.valueMaps, [field]: map as Record<string, StatusAction> & Record<string, string> } }
}

export interface FlowContext {
  kind: Kind
  profile: MappingProfile
  table: SourceTable | null
  site: SiteProfile
  leaveInReview: boolean
}

const mapped = (p: MappingProfile, f: string): boolean => (p.columns[f] ?? []).length > 0

/** Whether the user may leave a step, and if not, one plain sentence that says why. */
export function canContinue(step: Step, c: FlowContext): { ok: boolean; reason: string } {
  const ok = { ok: true, reason: '' }
  const no = (reason: string) => ({ ok: false, reason })
  if (step === 'file') return c.table === null ? no(t('import.chooseFirst')) : ok
  if (step === 'columns') {
    for (const f of MANDATORY[c.kind]) {
      if (f === 'workType' && c.profile.singleWorkType !== undefined) continue
      if (!mapped(c.profile, f)) return no(t('import.need.column', { label: labelOf(c.kind, f) }))
    }
    if (c.kind === 'cases') {
      const coords = mapped(c.profile, 'latitude') && mapped(c.profile, 'longitude')
      if (mapped(c.profile, 'latitude') !== mapped(c.profile, 'longitude')) return no(t('import.need.bothCoords'))
      if (!coords && !mapped(c.profile, 'area') && !mapped(c.profile, 'postalCode') && !mapped(c.profile, 'address')) {
        return no(t('import.need.place'))
      }
    }
    return ok
  }
  if (step === 'values' && c.table !== null && !c.leaveInReview && valueFields(c.kind, c.profile).includes('workType')) {
    const open = valueRows(c.table, c.profile, c.site, 'workType').filter((r) => r.target === null).length
    if (open > 0) return no(tn('import.need.categories', open))
  }
  return ok
}

export interface FlowState {
  step: Step
  fileName: string
  table: SourceTable | null
  kind: Kind
  result: SuggestResult | null
  profile: MappingProfile | null
  /** A saved mapping fits this file's layout: the Columns and Values steps are skipped. */
  knownProfile: boolean
  leaveInReview: boolean
  error: string | null
}

export type FlowAction =
  | { type: 'file'; table: SourceTable; fileName: string; kind: Kind; result: SuggestResult; known: MappingProfile | null }
  | { type: 'kind'; kind: Kind; result: SuggestResult; known?: MappingProfile | null }
  | { type: 'columns'; field: string; headers: string[] }
  | { type: 'singleWorkType'; name: string | null }
  | { type: 'dateOrder'; order: 'dmy' | 'mdy' | 'ymd' }
  | { type: 'value'; field: ValueField; source: string; target: string | null }
  | { type: 'leaveInReview'; on: boolean }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'error'; message: string }
  | { type: 'imported' }
  | { type: 'reset' }

export const initialFlow: FlowState = {
  step: 'file', fileName: '', table: null, kind: 'cases', result: null, profile: null, knownProfile: false, leaveInReview: false, error: null,
}

export function flowReducer(s: FlowState, a: FlowAction): FlowState {
  const withProfile = (fn: (p: MappingProfile) => MappingProfile): FlowState => (s.profile === null ? s : { ...s, profile: fn(s.profile) })
  switch (a.type) {
    case 'file':
      return {
        ...initialFlow, table: a.table, fileName: a.fileName, kind: a.kind, result: a.result,
        profile: a.known ?? a.result.profile, knownProfile: a.known !== null,
      }
    case 'kind':
      return { ...s, kind: a.kind, result: a.result, profile: a.known ?? a.result.profile, knownProfile: (a.known ?? null) !== null, error: null }
    case 'columns':
      return withProfile((p) => setColumns(p, a.field, a.headers))
    case 'singleWorkType':
      return withProfile((p) => {
        const { singleWorkType: _drop, ...rest } = p
        return a.name === null ? rest : { ...rest, singleWorkType: a.name }
      })
    case 'dateOrder':
      return withProfile((p) => ({ ...p, formats: { ...p.formats, dateOrder: a.order } }))
    case 'value':
      return withProfile((p) => setValue(p, a.field, a.source, a.target))
    case 'leaveInReview':
      return { ...s, leaveInReview: a.on }
    case 'next': {
      if (s.table === null || s.profile === null) return s
      if (s.step === 'file') return { ...s, step: s.knownProfile ? 'check' : 'columns', error: null }
      if (s.step === 'columns') return { ...s, step: valueFields(s.kind, s.profile).length > 0 ? 'values' : 'check' }
      if (s.step === 'values') return { ...s, step: 'check' }
      return s
    }
    case 'back': {
      if (s.profile === null) return s
      if (s.step === 'check') return { ...s, step: s.knownProfile ? 'file' : valueFields(s.kind, s.profile).length > 0 ? 'values' : 'columns' }
      if (s.step === 'values') return { ...s, step: 'columns' }
      if (s.step === 'columns') return { ...s, step: 'file' }
      return s
    }
    case 'error':
      return { ...s, error: a.message }
    case 'imported':
      return { ...s, step: 'done' }
    case 'reset':
      return initialFlow
  }
}
