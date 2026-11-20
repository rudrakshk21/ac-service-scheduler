import { describe, expect, it } from 'vitest'
import { IntakeError } from '../errors'
import { buildTable } from '../read/table'
import { parseProfile, serializeProfile, type MappingProfile } from './profile'
import { suggestProfile } from './suggest'

const full: MappingProfile = {
  profileVersion: 1,
  name: 'Vendor export',
  kind: 'cases',
  fingerprint: 'abcd1234',
  sheet: 'Data',
  headerRow: 2,
  formats: { encoding: 'windows-1252', delimiter: ';', dateOrder: 'dmy', decimal: ',' },
  columns: { caseId: ['Ticket No'], area: ['Locality', 'City'] },
  valueMaps: {
    workType: { 'ac repair': 'Service' },
    status: { 'pending parts': 'hold', closed: 'ignore', open: 'schedule' },
    priority: { p1: 'Escalated' },
    skill: { 'split service': 'Service' },
  },
  singleWorkType: 'Service',
}
const clone = () => structuredClone(full) as unknown as Record<string, unknown> & { valueMaps: Record<string, Record<string, unknown>> }

describe('parseProfile', () => {
  it('reads back what serializeProfile wrote', () => {
    expect(parseProfile(serializeProfile(full))).toEqual(full)
  })
  it('accepts a minimal profile', () => {
    const minimal = { profileVersion: 1, name: 'm', kind: 'places', fingerprint: 'x', columns: {}, valueMaps: { workType: {}, status: {}, priority: {}, skill: {} } }
    expect(parseProfile(JSON.stringify(minimal))).toEqual({ ...minimal, formats: {} })
  })
  const bad: [string, (p: ReturnType<typeof clone>) => void, string][] = [
    ['a missing version', (p) => { delete p.profileVersion }, 'Mapping profile: profileVersion must be 1'],
    ['a newer version', (p) => { p.profileVersion = 2 }, 'profileVersion is newer than this app understands'],
    ['a wrong kind', (p) => { p.kind = 'orders' }, 'kind must be cases, technicians or places'],
    ['columns that are not lists', (p) => { p.columns = { caseId: 'Ticket No' } }, 'columns.caseId must be a list'],
    ['an empty column name', (p) => { p.columns = { caseId: [''] } }, 'columns.caseId[0] must be text'],
    ['a bad status action', (p) => { p.valueMaps.status = { 'pending parts': 'wait' } }, 'valueMaps.status["pending parts"] must be schedule, hold or ignore'],
    ['a value map that is not an object', (p) => { p.valueMaps.workType = [] as never }, 'valueMaps.workType must be an object'],
    ['a bad date order', (p) => { (p.formats as Record<string, unknown>).dateOrder = 'ydm' }, 'formats.dateOrder must be dmy, mdy or ymd'],
    ['a bad header row', (p) => { p.headerRow = -1 }, 'headerRow must be at least 0'],
    ['no name', (p) => { delete p.name }, 'name must be text'],
  ]
  it.each(bad)('rejects %s with a message that names the field', (_label, mutate, message) => {
    const p = clone()
    mutate(p)
    expect(() => parseProfile(JSON.stringify(p))).toThrow(message)
    try {
      parseProfile(JSON.stringify(p))
    } catch (e) {
      expect(e).toBeInstanceOf(IntakeError)
      expect((e as IntakeError).code).toBe('bad_profile')
    }
  })
  it('rejects text that is not JSON or not an object', () => {
    expect(() => parseProfile('{nope')).toThrow('not valid JSON')
    expect(() => parseProfile('[]')).toThrow('file must be an object')
  })
})

describe('a profile holds no case data', () => {
  it('a suggested profile carries column names, never cell values', () => {
    const marker = 'ZZ-CASE-VALUE-9'
    const t = buildTable(
      [['Ticket No', 'Category', 'Locality'], [marker, 'Splits', 'Hidden Town'], ['ZZ-CASE-VALUE-8', 'Splits', 'Hidden Town']],
      { format: 'csv', fileName: 'f.csv', sheets: [], sheet: '', encoding: 'utf-8', encodingConfident: true, delimiter: ',', delimiterConfident: true },
    )
    const json = serializeProfile(suggestProfile(t, 'cases', null).profile)
    expect(json).not.toContain(marker)
    expect(json).not.toContain('ZZ-CASE-VALUE')
    expect(json).not.toContain('Hidden Town')
    expect(json).not.toContain('Splits')
  })
})
