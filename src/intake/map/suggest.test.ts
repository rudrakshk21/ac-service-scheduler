import { describe, expect, it } from 'vitest'
import { buildTable, type Cell, type SourceTable } from '../read/table'
import { fingerprintOf } from './profile'
import { suggestProfile } from './suggest'

function table(headers: string[], rows: Cell[][], format: SourceTable['format'] = 'csv'): SourceTable {
  return buildTable(
    [headers, ...rows],
    {
      format, fileName: 'f.csv', sheets: [], sheet: format === 'xlsx' ? 'Data' : '', encoding: 'utf-8', encodingConfident: true,
      delimiter: format === 'csv' ? ',' : null, delimiterConfident: true,
    },
  )
}
const find = (r: ReturnType<typeof suggestProfile>, field: string) => r.suggestions.find((s) => s.field === field)

describe('suggestProfile: names', () => {
  const r = suggestProfile(
    table(['Ticket No', 'Created On', 'Category', 'Locality', 'Status'], [['100001', '13/10/2026', 'AC Repair', 'North', 'Open'], ['100002', '14/10/2026', 'AC Install', 'South', 'Closed']]),
    'cases', null,
  )
  it('matches the known names with full confidence and a reason', () => {
    for (const [field, column] of [['caseId', 'Ticket No'], ['reportedAt', 'Created On'], ['workType', 'Category'], ['area', 'Locality'], ['status', 'Status']]) {
      const s = find(r, field)
      expect(s?.columns).toEqual([column])
      expect(s?.confidence).toBe(1)
      expect(s?.reason).toContain(column)
    }
  })
  it('pre-fills the draft profile from confident suggestions and records the layout', () => {
    expect(r.profile.columns).toEqual({ caseId: ['Ticket No'], workType: ['Category'], area: ['Locality'], status: ['Status'], reportedAt: ['Created On'] })
    expect(r.profile.fingerprint).toBe(fingerprintOf(['Ticket No', 'Created On', 'Category', 'Locality', 'Status']))
    expect(r.profile.kind).toBe('cases')
    expect(r.profile.formats).toMatchObject({ encoding: 'utf-8', delimiter: ',', dateOrder: 'dmy' })
    expect(r.needsDateOrder).toBe(false)
    expect(r.unmatchedColumns).toEqual([])
  })
  it('ignores case, accents, punctuation and spacing', () => {
    for (const h of ['TICKET-NO', ' ticket no ', 'Ticket_No']) {
      expect(find(suggestProfile(table([h, 'Category'], [['100001', 'x']]), 'cases', null), 'caseId')?.confidence).toBe(1)
    }
  })
  it('uses the names a site has confirmed', () => {
    const r2 = suggestProfile(table(['Docket', 'Category'], [['100001', 'x']]), 'cases', { columnNames: { caseId: ['Docket'] } })
    expect(find(r2, 'caseId')).toMatchObject({ columns: ['Docket'], confidence: 1 })
  })
  it('accepts the open-format names with full confidence', () => {
    const r3 = suggestProfile(table(['case_id', 'work_type', 'postal_code'], [['1', 'x', '111111']]), 'cases', null)
    expect(r3.suggestions.map((s) => [s.field, s.confidence])).toEqual([['caseId', 1], ['workType', 1], ['postalCode', 1]])
  })
  it('scores a header that contains a known name below 1 but still offers it', () => {
    // "Overall Status" is not a known name, but its words contain the known name "status": 0.6 + 0.3 x (1 of 2 words).
    const r4 = suggestProfile(table(['Overall Status', 'Ticket No'], [['x', '100001']]), 'cases', null)
    expect(find(r4, 'status')?.confidence).toBeCloseTo(0.75, 5)
    expect(find(r4, 'status')?.reason).toContain('resembles')
  })
})

describe('suggestProfile: nested JSON names and bare names', () => {
  it('scores `location.lat` by its last part, a little lower than a plain name', () => {
    const r = suggestProfile(
      table(['id', 'created', 'category', 'location.lat', 'location.lon', 'location.city'], [['1', '2026-10-13', 'x', '20.1', '30.2', 'North']]),
      'cases', null,
    )
    expect(find(r, 'caseId')).toMatchObject({ columns: ['id'], confidence: 1 })
    expect(find(r, 'reportedAt')).toMatchObject({ columns: ['created'], confidence: 1 })
    expect(find(r, 'latitude')).toMatchObject({ columns: ['location.lat'], confidence: 0.95 })
    expect(find(r, 'longitude')).toMatchObject({ columns: ['location.lon'], confidence: 0.95 })
    expect(find(r, 'area')).toMatchObject({ columns: ['location.city'], confidence: 0.95 })
    expect(r.profile.columns.latitude).toEqual(['location.lat'])
  })
})

describe('suggestProfile: values', () => {
  it('offers date-looking and id-looking columns with a lower confidence', () => {
    const r = suggestProfile(
      table(['Col A', 'Col B', 'Kind'], [['100001', '2026-10-13', 'a'], ['100002', '2026-10-14', 'b'], ['100003', '2026-10-15', 'a']]),
      'cases', null,
    )
    expect(find(r, 'caseId')).toMatchObject({ columns: ['Col A'], confidence: 0.5 })
    expect(find(r, 'caseId')?.reason).toContain('unique')
    expect(find(r, 'reportedAt')).toMatchObject({ columns: ['Col B'], confidence: 0.55 })
    expect(find(r, 'reportedAt')?.reason).toContain('dates')
    expect(find(r, 'workType')).toMatchObject({ columns: ['Kind'], confidence: 0.4 })
    expect(r.profile.columns).toEqual({})
  })
  it('tells due dates from reported dates by the words in the header', () => {
    const r = suggestProfile(
      table(['Ticket No', 'Promised By Date', 'Opened'], [['100001', '2026-10-13', '2026-10-01'], ['100002', '2026-10-14', '2026-10-02']]),
      'cases', null,
    )
    expect(find(r, 'reportedAt')?.columns).toEqual(['Opened'])
    expect(find(r, 'dueAt')).toBeUndefined()
    const r2 = suggestProfile(table(['Ticket No', 'SLA Whatever', 'X'], [['100001', '2026-10-13', 'a'], ['100002', '2026-10-14', 'b']]), 'cases', null)
    expect(find(r2, 'dueAt')?.columns).toEqual(['SLA Whatever'])
  })
  it('reads coordinates and decimal commas', () => {
    const r = suggestProfile(table(['ID', 'Lat', 'Lng'], [['100001', '8,5241', '76,9366'], ['100002', '8,6', '76,8']]), 'cases', null)
    expect(find(r, 'latitude')?.columns).toEqual(['Lat'])
    expect(find(r, 'longitude')?.columns).toEqual(['Lng'])
    expect(r.profile.formats.decimal).toBe(',')
  })
  it('asks for the date order when day and month cannot be told apart', () => {
    const r = suggestProfile(table(['Ticket No', 'Created On'], [['100001', '04/05/2026'], ['100002', '06/07/2026']]), 'cases', null)
    expect(r.needsDateOrder).toBe(true)
    expect(r.profile.formats.dateOrder).toBeUndefined()
  })
  it('records the sheet of an Excel file', () => {
    const r = suggestProfile(table(['Ticket No', 'Category'], [['100001', 'x']], 'xlsx'), 'cases', null)
    expect(r.profile.sheet).toBe('Data')
    expect(r.profile.formats.encoding).toBeUndefined()
  })
})

describe('suggestProfile: personal data', () => {
  const r = suggestProfile(
    table(['Ticket No', 'Category', 'Customer Name', 'Phone', 'Address', 'Locality'], [['100001', 'x', 'A. Person', '123', '1 Road', 'North']]),
    'cases', null,
  )
  it('marks personal columns and keeps them out of the draft profile', () => {
    expect(find(r, 'customerName')).toMatchObject({ columns: ['Customer Name'], personal: true })
    expect(find(r, 'address')).toMatchObject({ columns: ['Address'], personal: true })
    expect(r.personalColumns.sort()).toEqual(['Address', 'Customer Name', 'Phone'])
    expect(Object.keys(r.profile.columns).sort()).toEqual(['area', 'caseId', 'workType'])
    expect(r.unmatchedColumns).toEqual([])
  })
  it('does not treat a technician name column as personal', () => {
    const t = suggestProfile(table(['Name', 'Skills'], [['Tech One', 'Install']]), 'technicians', null)
    expect(t.profile.columns).toEqual({ name: ['Name'], skills: ['Skills'] })
    expect(t.personalColumns).toEqual([])
  })
})

describe('suggestProfile: several columns', () => {
  it('lets a location come from several columns and skills from several columns', () => {
    const r = suggestProfile(table(['Ticket No', 'Locality', 'City'], [['100001', 'a', 'b']]), 'cases', null)
    expect(find(r, 'area')?.columns).toEqual(['Locality', 'City'])
    expect(r.profile.columns.area).toEqual(['Locality', 'City'])
    const t = suggestProfile(table(['Name', 'Skill', 'Trade'], [['T', 'a', 'b']]), 'technicians', null)
    expect(t.profile.columns.skills).toEqual(['Skill', 'Trade'])
  })
  it('lists columns it could not place', () => {
    const r = suggestProfile(table(['Ticket No', 'Zzz'], [['100001', 'a'], ['100002', 'a']]), 'cases', null)
    expect(r.unmatchedColumns).toEqual(['Zzz'])
  })
})
