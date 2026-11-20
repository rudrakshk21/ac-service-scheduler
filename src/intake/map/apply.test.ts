import { describe, expect, it } from 'vitest'
import { buildTable, type Cell, type SourceTable } from '../read/table'
import type { SiteProfile } from '../site/site'
import { starterSite } from '../site/starter'
import { applyProfile, parseClock } from './apply'
import type { MappingProfile } from './profile'

const site: SiteProfile = {
  ...starterSite(),
  places: [
    { name: 'North Town', latitude: 20.1, longitude: 30.05, postalCode: '111111' },
    { name: 'South Bay', latitude: 19.95, longitude: 30.1 },
  ],
  aliases: { 'n town': 'North Town' },
}
const table = (headers: string[], rows: Cell[][]): SourceTable =>
  buildTable([headers, ...rows], { format: 'csv', fileName: 'f.csv', sheets: [], sheet: '', encoding: 'utf-8', encodingConfident: true, delimiter: ',', delimiterConfident: true })

const HEADERS = ['Ticket No', 'Created On', 'Category', 'Locality', 'Status', 'Priority', 'Due', 'Product', 'Notes', 'Customer Name', 'Internal Memo']
const profile = (over: Partial<MappingProfile> = {}): MappingProfile => ({
  profileVersion: 1, name: 'p', kind: 'cases', fingerprint: 'x',
  formats: { dateOrder: 'dmy' },
  columns: {
    caseId: ['Ticket No'], reportedAt: ['Created On'], workType: ['Category'], area: ['Locality'], status: ['Status'],
    priority: ['Priority'], dueAt: ['Due'], productType: ['Product'], notes: ['Notes'],
  },
  valueMaps: {
    workType: { repair: 'Service', 'new unit': 'Installation' },
    status: { open: 'schedule', 'pending parts': 'hold', closed: 'ignore' },
    priority: { p1: 'Escalated' },
    skill: {},
  },
  ...over,
})
const row = (over: Partial<Record<string, Cell>> = {}): Cell[] => {
  const base: Record<string, Cell> = {
    'Ticket No': '100001', 'Created On': '13/10/2026', Category: 'Repair', Locality: 'North Town', Status: 'Open', Priority: 'P1',
    Due: '20/10/2026', Product: 'Split', Notes: 'n', 'Customer Name': 'SECRET-PERSON', 'Internal Memo': 'SECRET-MEMO', ...over,
  }
  return HEADERS.map((h) => base[h] ?? null)
}
const IMPORT = '2026-10-15'

describe('applyProfile: cases', () => {
  it('reads mapped fields only; nothing from unmapped columns reaches the output', () => {
    const out = applyProfile(table(HEADERS, [row()]), profile(), site, IMPORT)
    expect(out.cases).toEqual([{
      caseId: '100001', workType: 'Repair', workTypeName: 'Service', area: 'North Town', place: 'North Town', status: 'Open',
      reportedAt: '2026-10-13', priority: 'P1', priorityLevel: 'Escalated', dueAt: '2026-10-20', productType: 'Split', notes: 'n', state: 'active',
    }])
    const json = JSON.stringify(out)
    expect(json).not.toContain('SECRET-PERSON')
    expect(json).not.toContain('SECRET-MEMO')
    expect(out.exceptions).toEqual([])
  })
  it('keeps a personal field only when the user mapped it', () => {
    const p = profile()
    p.columns.customerName = ['Customer Name']
    expect(applyProfile(table(HEADERS, [row()]), p, site, IMPORT).cases[0].customerName).toBe('SECRET-PERSON')
  })
  it('uses the import date when there is no reported date, and reports an unreadable date', () => {
    const noCol = profile()
    delete noCol.columns.reportedAt
    expect(applyProfile(table(HEADERS, [row()]), noCol, site, IMPORT).cases[0].reportedAt).toBe(IMPORT)
    expect(applyProfile(table(HEADERS, [row({ 'Created On': null })]), profile(), site, IMPORT).cases[0].reportedAt).toBe(IMPORT)
    const bad = applyProfile(table(HEADERS, [row({ 'Created On': 'soon', Due: '31/02/2026' })]), profile(), site, IMPORT)
    expect(bad.cases[0].reportedAt).toBeUndefined()
    expect(bad.cases[0].dueAt).toBeUndefined()
    expect(bad.exceptions.filter((e) => e.issue === 'bad_date').map((e) => e.detail)).toEqual(['reportedAt "soon" is not a date', 'dueAt "31/02/2026" is not a date'])
    expect(bad.quality.badDates).toEqual([{ field: 'reportedAt', count: 1, examples: ['soon'] }, { field: 'dueAt', count: 1, examples: ['31/02/2026'] }])
  })
  it('sends an unknown category to review once per value in the report, and keeps the case', () => {
    const out = applyProfile(table(HEADERS, [row({ 'Ticket No': '1', Category: 'Deep clean' }), row({ 'Ticket No': '2', Category: 'Deep clean' })]), profile(), site, IMPORT)
    expect(out.cases.map((c) => c.state)).toEqual(['review', 'review'])
    expect(out.cases[0].workTypeName).toBeUndefined()
    expect(out.exceptions.filter((e) => e.issue === 'unknown_work_type').length).toBe(2)
    expect(out.quality.unknownValues).toEqual([{ field: 'workType', values: ['Deep clean'] }])
  })
  it('maps status words to hold and ignore; an unknown status stays schedulable and is reported', () => {
    const out = applyProfile(table(HEADERS, [
      row({ 'Ticket No': '1', Status: 'Pending Parts' }), row({ 'Ticket No': '2', Status: 'Closed' }), row({ 'Ticket No': '3', Status: 'Waiting' }),
    ]), profile(), site, IMPORT)
    expect(out.cases.map((c) => c.state)).toEqual(['hold', 'ignored', 'active'])
    expect(out.quality.unknownValues).toEqual([{ field: 'status', values: ['Waiting'] }])
  })
  it('imports a case with an unresolved place and raises No location', () => {
    const out = applyProfile(table(HEADERS, [row({ Locality: 'Nowhere' })]), profile(), site, IMPORT)
    expect(out.cases[0].place).toBeUndefined()
    expect(out.cases[0].state).toBe('active')
    expect(out.exceptions).toEqual([expect.objectContaining({ caseId: '100001', issue: 'no_location' })])
    expect(out.quality.unresolvedPlaces).toBe(1)
  })
  it('resolves through aliases and builds a location from several columns', () => {
    const p = profile()
    p.columns.area = ['Locality', 'Notes']
    const out = applyProfile(table(HEADERS, [row({ Locality: 'unknown place', Notes: 'N Town' })]), p, site, IMPORT)
    expect(out.cases[0].place).toBe('North Town')
  })
  it('creates places from coordinates', () => {
    const p = profile()
    p.columns = { caseId: ['Ticket No'], workType: ['Category'], latitude: ['Locality'], longitude: ['Notes'] }
    const out = applyProfile(table(HEADERS, [row({ Locality: '19.5', Notes: '30.5' }), row({ 'Ticket No': '2', Locality: '19.5', Notes: '30.5' })]), p, site, IMPORT)
    expect(out.cases.map((c) => c.place)).toEqual(['19.50000,30.50000', '19.50000,30.50000'])
    expect(out.places).toEqual([{ name: '19.50000,30.50000', latitude: 19.5, longitude: 30.5 }])
  })
  it('skips a row with no identifier and a total row, and counts them differently', () => {
    const out = applyProfile(table(HEADERS, [row(), row({ 'Ticket No': null }), row({ 'Ticket No': 'Total' })]), profile(), site, IMPORT)
    expect(out.cases.length).toBe(1)
    expect(out.exceptions).toEqual([expect.objectContaining({ caseId: '(row 2)', issue: 'missing_id' })])
    expect(out.quality.totalRowsSkipped).toBe(1)
    expect(out.quality.rowsRead).toBe(3)
  })
  it('skips total rows written in several languages', () => {
    const out = applyProfile(table(HEADERS, [row(), row({ 'Ticket No': 'Gesamt' }), row({ 'Ticket No': 'Summe 2026' }), row({ 'Ticket No': 'Somme' })]), profile(), site, IMPORT)
    expect(out.cases.length).toBe(1)
    expect(out.quality.totalRowsSkipped).toBe(3)
  })
  it('keeps the first row of a duplicated identifier and reports the rest', () => {
    const out = applyProfile(table(HEADERS, [row({ Notes: 'first' }), row({ Notes: 'second' })]), profile(), site, IMPORT)
    expect(out.cases.length).toBe(1)
    expect(out.cases[0].notes).toBe('first')
    expect(out.quality.duplicates).toBe(1)
    expect(out.exceptions).toEqual([expect.objectContaining({ caseId: '100001', issue: 'duplicate_id' })])
  })
  it('turns identifiers into trimmed text, also from numbers', () => {
    const out = applyProfile(table(HEADERS, [row({ 'Ticket No': 100001 }), row({ 'Ticket No': '100002.0' }), row({ 'Ticket No': '  A-7 ' })]), profile(), site, IMPORT)
    expect(out.cases.map((c) => c.caseId)).toEqual(['100001', '100002', 'A-7'])
  })
  it('reads durations with the profile decimal mark and reports the share of filled fields', () => {
    const p = profile({ formats: { dateOrder: 'dmy', decimal: ',' } })
    p.columns.durationMin = ['Product']
    const out = applyProfile(table(HEADERS, [row({ 'Ticket No': '1', Product: '45,5' }), row({ 'Ticket No': '2', Product: null, Notes: null })]), p, site, IMPORT)
    expect(out.cases[0].durationMin).toBe(45.5)
    expect(out.quality.filled.durationMin).toBe(0.5)
    expect(out.quality.filled.notes).toBe(0.5)
    expect(out.quality.filled.caseId).toBe(1)
  })
  it('passes the table\'s blank and ragged row counts into the report', () => {
    const t = table(HEADERS, [row(), [null, null], ['100002']])
    const out = applyProfile(t, profile(), site, IMPORT)
    expect(out.quality.blankRowsSkipped).toBe(1)
    expect(out.quality.raggedRows).toBe(1)
  })
})

describe('applyProfile: technicians', () => {
  const tHeaders = ['Name', 'Work', 'Trade', 'Active', 'Leave From', 'Leave To', 'Start Area', 'Shift Start', 'Shift Hours', 'Break']
  const tProfile = (): MappingProfile => ({
    profileVersion: 1, name: 't', kind: 'technicians', fingerprint: 'x', formats: { dateOrder: 'ymd' },
    columns: { name: ['Name'], skills: ['Work', 'Trade'], active: ['Active'], leaveFrom: ['Leave From'], leaveTo: ['Leave To'], startArea: ['Start Area'], shiftStart: ['Shift Start'], shiftHours: ['Shift Hours'], breakMin: ['Break'] },
    valueMaps: { workType: {}, status: {}, priority: {}, skill: { 'ac fitting': 'Installation', 'split service': 'Service' } },
  })
  it('reads skills from one cell or several columns, and reports unknown skill words', () => {
    const out = applyProfile(table(tHeaders, [
      ['Tech One', 'AC fitting, Split service', null, 'yes', '2026-10-20', '2026-10-22', 'South Bay', '08:30', 8, 45],
      ['Tech Two', 'AC fitting', 'Plumbing', 'No', null, null, 'Nowhere', '8:30 PM', null, null],
    ]), tProfile(), site, IMPORT)
    expect(out.technicians[0]).toEqual({ name: 'Tech One', skills: ['Installation', 'Service'], active: true, leaveFrom: '2026-10-20', leaveTo: '2026-10-22', startPlace: 'South Bay', shiftStart: 510, shiftHours: 8, breakMin: 45 })
    expect(out.technicians[1]).toEqual({ name: 'Tech Two', skills: ['Installation'], active: false, shiftStart: 1230 })
    expect(out.quality.unknownValues).toEqual([{ field: 'skill', values: ['Plumbing'] }])
    expect(out.exceptions).toEqual([expect.objectContaining({ caseId: 'Tech Two', issue: 'no_location' })])
  })
  it('skips a row without a name and a repeated name', () => {
    const out = applyProfile(table(tHeaders, [['Tech One', 'AC fitting'], [null, 'AC fitting', 'x'], ['tech one', 'AC fitting']]), tProfile(), site, IMPORT)
    expect(out.technicians.length).toBe(1)
    expect(out.exceptions.map((e) => e.issue).sort()).toEqual(['duplicate_id', 'missing_id'])
  })
})

describe('applyProfile: places', () => {
  const pHeaders = ['Place', 'Lat', 'Lng', 'PIN', 'Zone']
  const pProfile = (): MappingProfile => ({
    profileVersion: 1, name: 'pl', kind: 'places', fingerprint: 'x', formats: { decimal: ',' },
    columns: { area: ['Place'], latitude: ['Lat'], longitude: ['Lng'], postalCode: ['PIN'], zone: ['Zone'] },
    valueMaps: { workType: {}, status: {}, priority: {}, skill: {} },
  })
  it('reads places and skips ones without usable coordinates or a name', () => {
    const out = applyProfile(table(pHeaders, [
      ['East Side', '8,5', '76,9', '333333', 'East'], ['Bad One', 'x', '1', null, null], ['Far', '95', '10', null, null], [null, '1', '1', null, null], ['east side', '1', '1', null, null],
    ]), pProfile(), site, IMPORT)
    expect(out.places).toEqual([{ name: 'East Side', latitude: 8.5, longitude: 76.9, postalCode: '333333', zone: 'East' }])
    expect(out.exceptions.map((e) => [e.caseId, e.issue])).toEqual([['Bad One', 'no_location'], ['Far', 'no_location'], ['(row 4)', 'missing_id'], ['east side', 'duplicate_id']])
  })
})

describe('parseClock', () => {
  it('reads the usual ways to write a time of day', () => {
    expect(parseClock('08:30')).toBe(510)
    expect(parseClock('8.30')).toBe(510)
    expect(parseClock('8:30 AM')).toBe(510)
    expect(parseClock('8:30 PM')).toBe(1230)
    expect(parseClock('12:15 AM')).toBe(15)
    expect(parseClock('08:30:15')).toBe(510)
    expect(parseClock(0.354167)).toBe(510)
    expect(parseClock('0.354167')).toBe(510)
    expect(parseClock(new Date(Date.UTC(1899, 11, 30, 9, 15)))).toBe(555)
  })
  it('gives nothing for what is not a time', () => {
    for (const v of ['25:00', '8:75', 'soon', '', 5, null, undefined, true]) expect(parseClock(v as Cell | undefined)).toBeUndefined()
  })
})
