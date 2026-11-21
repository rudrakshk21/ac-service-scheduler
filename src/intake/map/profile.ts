import { t } from '../../i18n'
import { checker, parseJson } from '../validate'
import { normaliseName, type Kind, type StatusAction } from './model'

/** A saved mapping of one file layout to the common model. It holds no case data (requirements: privacy rules). */
export interface MappingProfile {
  profileVersion: 1
  name: string
  kind: Kind
  /** Hash of the normalised column headers: the same layout gets the same profile without questions. */
  fingerprint: string
  sheet?: string
  headerRow?: number
  formats: {
    encoding?: string
    delimiter?: string
    dateOrder?: 'dmy' | 'mdy' | 'ymd'
    decimal?: '.' | ','
  }
  /** Field name to the source column headers that feed it (several for a location or for skills). */
  columns: Record<string, string[]>
  valueMaps: {
    /** Normalised source value to a site work type name. */
    workType: Record<string, string>
    status: Record<string, StatusAction>
    /** Normalised source value to a site priority level name. */
    priority: Record<string, string>
    /** Normalised source value to a site skill name. */
    skill: Record<string, string>
  }
  /** Used when the file has no category column. */
  singleWorkType?: string
}

/** FNV-1a 32-bit hash of the normalised headers, as 8 hex digits. */
export function fingerprintOf(headers: string[]): string {
  const text = headers.map(normaliseName).join('|')
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

const KINDS = ['cases', 'technicians', 'places'] as const
const ACTIONS = ['schedule', 'hold', 'ignore'] as const
const DATE_ORDERS = ['dmy', 'mdy', 'ymd'] as const
const DECIMALS = ['.', ','] as const

/** A profile as a JSON file. It holds no case data. */
export function serializeProfile(p: MappingProfile): string {
  return JSON.stringify(p, null, 2) + '\n'
}

/** Reads a profile file. Throws an `IntakeError` (`bad_profile`) that names the field when it is invalid. */
export function parseProfile(text: string): MappingProfile {
  const prefix = t('intake.prefix.profile')
  const c = checker('bad_profile', prefix)
  const o = c.record(parseJson(text, 'bad_profile', prefix), 'file')
  if (o.profileVersion !== 1) {
    c.fail('profileVersion', typeof o.profileVersion === 'number' && o.profileVersion > 1 ? t('intake.v.newer') : t('intake.v.mustBeOne'))
  }
  const formatsIn = o.formats === undefined ? {} : c.record(o.formats, 'formats')
  const formats: MappingProfile['formats'] = {}
  if (formatsIn.encoding !== undefined) formats.encoding = c.text(formatsIn.encoding, 'formats.encoding')
  if (formatsIn.delimiter !== undefined) formats.delimiter = c.text(formatsIn.delimiter, 'formats.delimiter')
  if (formatsIn.dateOrder !== undefined) formats.dateOrder = c.oneOf(formatsIn.dateOrder, 'formats.dateOrder', DATE_ORDERS)
  if (formatsIn.decimal !== undefined) formats.decimal = c.oneOf(formatsIn.decimal, 'formats.decimal', DECIMALS)

  const columns: Record<string, string[]> = {}
  for (const [field, v] of Object.entries(c.record(o.columns, 'columns'))) {
    columns[field] = c.list(v, `columns.${field}`).map((h, i) => c.text(h, `columns.${field}[${i}]`))
  }
  const vm = c.record(o.valueMaps, 'valueMaps')
  const strings = (v: unknown, path: string): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const [k, x] of Object.entries(c.record(v, path))) out[k] = c.text(x, `${path}["${k}"]`)
    return out
  }
  const status: Record<string, StatusAction> = {}
  for (const [k, x] of Object.entries(c.record(vm.status, 'valueMaps.status'))) {
    status[k] = c.oneOf(x, `valueMaps.status["${k}"]`, ACTIONS)
  }
  const profile: MappingProfile = {
    profileVersion: 1,
    name: c.text(o.name, 'name'),
    kind: c.oneOf(o.kind, 'kind', KINDS),
    fingerprint: c.text(o.fingerprint, 'fingerprint'),
    formats,
    columns,
    valueMaps: {
      workType: strings(vm.workType, 'valueMaps.workType'),
      status,
      priority: strings(vm.priority, 'valueMaps.priority'),
      skill: strings(vm.skill, 'valueMaps.skill'),
    },
  }
  const sheet = c.optText(o.sheet, 'sheet')
  if (sheet !== undefined) profile.sheet = sheet
  if (o.headerRow !== undefined) profile.headerRow = c.int(o.headerRow, 'headerRow', 0)
  const single = c.optText(o.singleWorkType, 'singleWorkType')
  if (single !== undefined) profile.singleWorkType = single
  return profile
}
