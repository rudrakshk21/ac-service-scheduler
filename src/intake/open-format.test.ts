import { describe, expect, it } from 'vitest'
import { CASE_FIELDS, FIELDS, MANDATORY, openName, PLACE_FIELDS, TECHNICIAN_FIELDS } from './map/model'
import { parseProfile, serializeProfile } from './map/profile'
import { suggestProfile } from './map/suggest'
import { isOpenFormat, openFormatProfile, openFormatSchema, templateCsv } from './open-format'
import { buildTable } from './read/table'

const files = import.meta.glob('../../public/templates/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const file = (name: string): string => {
  const hit = Object.entries(files).find(([path]) => path.endsWith(`/${name}`))
  if (hit === undefined) throw new Error(`public/templates/${name} is missing`)
  return hit[1].replace(/\r\n/g, '\n')
}

describe('openFormatProfile', () => {
  it('maps every field to its own open name, except personal data, and survives a round trip through a file', () => {
    const p = openFormatProfile('cases')
    expect(p.columns.caseId).toEqual(['case_id'])
    expect(p.columns.postalCode).toEqual(['postal_code'])
    expect(p.columns.customerName).toBeUndefined()
    expect(Object.keys(p.columns).length).toBe(CASE_FIELDS.length - 1)
    expect(p.formats).toEqual({ dateOrder: 'ymd', decimal: '.' })
    expect(parseProfile(serializeProfile(p))).toEqual(p)
    expect(Object.keys(openFormatProfile('technicians').columns)).toEqual([...TECHNICIAN_FIELDS])
    expect(Object.keys(openFormatProfile('places').columns)).toEqual([...PLACE_FIELDS])
  })
})

describe('isOpenFormat', () => {
  it('is true for open-format headers and false for anything else', () => {
    expect(isOpenFormat(['case_id', 'work_type', 'area'], 'cases')).toBe(true)
    expect(isOpenFormat(['Case_ID', ' Work_Type ', 'area', 'my own column'], 'cases')).toBe(true)
    expect(isOpenFormat(['Ticket No', 'Category'], 'cases')).toBe(false)
    expect(isOpenFormat(['case_id', 'area'], 'cases')).toBe(false) // work_type is missing
    expect(isOpenFormat(['case_id', 'work_type', 'a', 'b', 'c', 'd'], 'cases')).toBe(false) // mostly other columns
    expect(isOpenFormat([], 'cases')).toBe(false)
    expect(isOpenFormat(['name', 'skills'], 'technicians')).toBe(true)
    expect(isOpenFormat(['area', 'latitude', 'longitude'], 'places')).toBe(true)
  })
})

describe('suggestProfile on open-format files', () => {
  it('maps every column with full confidence', () => {
    const t = buildTable(
      [['case_id', 'work_type', 'postal_code', 'reported_at', 'status'], ['1', 'Service', '111111', '2026-10-13', 'open']],
      { format: 'csv', fileName: 'f.csv', sheets: [], sheet: '', encoding: 'utf-8', encodingConfident: true, delimiter: ',', delimiterConfident: true },
    )
    const r = suggestProfile(t, 'cases', null)
    expect(r.suggestions.map((s) => [s.field, s.confidence])).toEqual([
      ['caseId', 1], ['workType', 1], ['postalCode', 1], ['status', 1], ['reportedAt', 1],
    ])
  })
})

describe('templates and schema', () => {
  it('templateCsv is the header row of the model, in order, ending with a newline', () => {
    expect(templateCsv('cases')).toBe(CASE_FIELDS.map(openName).join(',') + '\n')
    expect(templateCsv('cases').startsWith('case_id,work_type,latitude,longitude,postal_code,area,address,status,reported_at,priority,due_at,product_type,duration_min,earliest_date,technician,customer_name,notes,other_ref\n')).toBe(true)
  })
  it('the committed files equal what the code produces', () => {
    for (const kind of ['cases', 'technicians', 'places'] as const) expect(file(`${kind}.csv`)).toBe(templateCsv(kind))
    expect(JSON.parse(file('open-format.schema.json'))).toEqual(openFormatSchema())
  })
  it('the schema lists every field once per entity and marks the mandatory ones required', () => {
    const schema = openFormatSchema() as { properties: Record<string, { items: { properties: Record<string, unknown>; required: string[]; anyOf?: unknown[] } }> }
    for (const kind of ['cases', 'technicians', 'places'] as const) {
      const item = schema.properties[kind].items
      expect(Object.keys(item.properties)).toEqual(FIELDS[kind].map(openName))
      expect(item.required).toEqual(MANDATORY[kind].map(openName))
    }
    expect(schema.properties.cases.items.anyOf).toHaveLength(4)
    expect(schema.properties.technicians.items.anyOf).toBeUndefined()
    expect(openFormatSchema().$schema).toBe('https://json-schema.org/draft/2020-12/schema')
  })
})
