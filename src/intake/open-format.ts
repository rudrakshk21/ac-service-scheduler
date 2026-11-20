import { FIELDS, MANDATORY, normaliseName, openName, type Kind } from './map/model'
import type { MappingProfile } from './map/profile'

const NUMBER_FIELDS = new Set([
  'latitude', 'longitude', 'durationMin', 'startLatitude', 'startLongitude', 'endLatitude', 'endLongitude', 'shiftHours', 'breakMin',
])
const DATE_FIELDS = new Set(['reportedAt', 'dueAt', 'earliestDate', 'leaveFrom', 'leaveTo'])

/** Personal data: never read from an open-format file unless the user maps it by hand. */
const NOT_BY_DEFAULT = new Set(['customerName'])

/**
 * The built-in profile for files in the open data format (requirements FR-27): every field is mapped to its own open
 * name, so such a file imports with no mapping step. Dates are `YYYY-MM-DD`, decimals use the point.
 */
export function openFormatProfile(kind: Kind): MappingProfile {
  const columns: Record<string, string[]> = {}
  for (const f of FIELDS[kind]) if (!NOT_BY_DEFAULT.has(f)) columns[f] = [openName(f)]
  return {
    profileVersion: 1,
    name: `Open data format (${kind})`,
    kind,
    fingerprint: `open-format-${kind}`,
    formats: { dateOrder: 'ymd', decimal: '.' },
    columns,
    valueMaps: { workType: {}, status: {}, priority: {}, skill: {} },
  }
}

/** True when the headers are those of the open format: every mandatory open name is there and most headers are open names. */
export function isOpenFormat(headers: string[], kind: Kind): boolean {
  const have = new Set(headers.map(normaliseName))
  const open = new Set(FIELDS[kind].map((f) => normaliseName(openName(f))))
  const mandatory = MANDATORY[kind].map((f) => normaliseName(openName(f)))
  if (!mandatory.every((m) => have.has(m))) return false
  const known = headers.filter((h) => open.has(normaliseName(h))).length
  return headers.length > 0 && known / headers.length >= 0.6
}

/** The header row of a blank CSV template. */
export function templateCsv(kind: Kind): string {
  return FIELDS[kind].map(openName).join(',') + '\n'
}

function propertyOf(field: string): Record<string, unknown> {
  if (NUMBER_FIELDS.has(field)) return { type: 'number' }
  if (DATE_FIELDS.has(field)) return { type: 'string', format: 'date', description: 'YYYY-MM-DD' }
  if (field === 'active') return { type: ['boolean', 'string'], description: 'yes, no, true or false' }
  if (field === 'shiftStart') return { type: 'string', description: 'HH:MM' }
  if (field === 'skills') return { type: 'string', description: 'One or more skills separated by , ; / or |' }
  return { type: 'string' }
}

/** A JSON Schema (draft 2020-12) of the open data format: lists of cases, technicians and places. */
export function openFormatSchema(): Record<string, unknown> {
  const entity = (kind: Kind): Record<string, unknown> => {
    const properties: Record<string, unknown> = {}
    for (const f of FIELDS[kind]) properties[openName(f)] = propertyOf(f)
    const schema: Record<string, unknown> = {
      type: 'object',
      properties,
      required: MANDATORY[kind].map(openName),
      additionalProperties: false,
    }
    if (kind === 'cases') {
      schema.anyOf = [
        { required: ['latitude', 'longitude'] },
        { required: ['postal_code'] },
        { required: ['area'] },
        { required: ['address'] },
      ]
    }
    return schema
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'AC service scheduler open data format',
    description: 'Cases, technicians and places in the field names of the common data model. Files in this format import with no mapping step.',
    type: 'object',
    properties: {
      cases: { type: 'array', items: entity('cases') },
      technicians: { type: 'array', items: entity('technicians') },
      places: { type: 'array', items: entity('places') },
    },
  }
}
