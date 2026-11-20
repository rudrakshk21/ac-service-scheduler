/** What a file holds. A center may bring one file of each kind (DS-1 does). */
export type Kind = 'cases' | 'technicians' | 'places'

/** Fields of the common data model (requirements section 6.1). TypeScript names are camelCase; the open data format
 *  uses the snake_case form (`openName`). */
export const CASE_FIELDS = [
  'caseId', 'workType', 'latitude', 'longitude', 'postalCode', 'area', 'address', 'status', 'reportedAt', 'priority',
  'dueAt', 'productType', 'durationMin', 'earliestDate', 'technician', 'customerName', 'notes', 'otherRef',
] as const
export const TECHNICIAN_FIELDS = [
  'name', 'skills', 'active', 'leaveFrom', 'leaveTo', 'startArea', 'startLatitude', 'startLongitude', 'endArea',
  'endLatitude', 'endLongitude', 'shiftStart', 'shiftHours', 'breakMin',
] as const
export const PLACE_FIELDS = ['area', 'latitude', 'longitude', 'postalCode', 'zone'] as const

export const FIELDS: Record<Kind, readonly string[]> = {
  cases: CASE_FIELDS,
  technicians: TECHNICIAN_FIELDS,
  places: PLACE_FIELDS,
}

/** Mandatory fields. For cases a location (coordinates, postal code, area or address) is also mandatory. */
export const MANDATORY: Record<Kind, readonly string[]> = {
  cases: ['caseId', 'workType'],
  technicians: ['name', 'skills'],
  places: ['area', 'latitude', 'longitude'],
}

/** Recommended fields, used with the mandatory ones to judge how good the column suggestions are. */
export const RECOMMENDED: Record<Kind, readonly string[]> = {
  cases: ['status', 'reportedAt'],
  technicians: [],
  places: [],
}

/** Fields that usually hold personal data: marked in suggestions and left unmapped until the user chooses. */
export const PERSONAL_FIELDS: readonly string[] = ['customerName', 'address']

export type StatusAction = 'schedule' | 'hold' | 'ignore'

/** Lower-case, accents removed, punctuation turned into single spaces. Used to compare names and values. */
export function normaliseName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim()
}

/** The field name in the open data format: `postalCode` becomes `postal_code`. */
export function openName(field: string): string {
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}
