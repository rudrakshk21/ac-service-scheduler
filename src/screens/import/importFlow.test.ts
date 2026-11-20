import { describe, expect, it } from 'vitest'
import { CASE_FIELDS, PLACE_FIELDS, TECHNICIAN_FIELDS } from '../../intake/map/model'
import type { MappingProfile } from '../../intake/map/profile'
import { suggestProfile } from '../../intake/map/suggest'
import { buildTable, type Cell, type SourceTable } from '../../intake/read/table'
import { starterSite } from '../../intake/site/starter'
import {
  canContinue, dateReadings, describeTable, fieldRows, flowReducer, guessKind, initialFlow, labelOf, levelOf, sampleValues, setColumns, setValue, valueFields,
  valueOptions, valueRows, type FlowState,
} from './importFlow'

const site = starterSite()
const table = (headers: string[], rows: Cell[][]): SourceTable =>
  buildTable([headers, ...rows], { format: 'csv', fileName: 'f.csv', sheets: [], sheet: '', encoding: 'utf-8', encodingConfident: true, delimiter: ',', delimiterConfident: true })
const blank = (kind: MappingProfile['kind'] = 'cases'): MappingProfile => ({
  profileVersion: 1, name: 'p', kind, fingerprint: 'x', formats: {}, columns: {}, valueMaps: { workType: {}, status: {}, priority: {}, skill: {} },
})

const CASES = table(['Ticket No', 'Category', 'Locality', 'Status', 'Priority'], [
  ['1', 'AC Repair', 'North', 'Open', 'P1'], ['2', 'ac repair ', 'North', 'Open', 'P2'], ['3', 'Installation', 'South', 'Pending', null], ['4', 'Cleaning', 'South', 'Open', 'P1'],
])

describe('labels and levels', () => {
  it('labels every field of every kind in plain words', () => {
    for (const f of CASE_FIELDS) expect(labelOf('cases', f)).not.toBe(f)
    for (const f of TECHNICIAN_FIELDS) expect(labelOf('technicians', f)).not.toBe(f)
    for (const f of PLACE_FIELDS) expect(labelOf('places', f)).not.toBe(f)
    expect(labelOf('cases', 'area')).toBe('Area or place name')
    expect(labelOf('places', 'area')).toBe('Place name')
  })
  it('knows what is needed, helpful and optional', () => {
    expect(levelOf('cases', 'caseId')).toBe('required')
    expect(levelOf('cases', 'area')).toBe('recommended')
    expect(levelOf('cases', 'status')).toBe('recommended')
    expect(levelOf('cases', 'notes')).toBe('optional')
    expect(levelOf('technicians', 'skills')).toBe('required')
    expect(levelOf('places', 'zone')).toBe('optional')
  })
})

describe('guessKind', () => {
  it('tells cases, technicians and places apart', () => {
    expect(guessKind(CASES, site)).toBe('cases')
    expect(guessKind(table(['Name', 'Skills', 'Start Area'], [['A', 'x', 'y']]), site)).toBe('technicians')
    expect(guessKind(table(['Place', 'Latitude', 'Longitude'], [['A', '1', '2']]), site)).toBe('places')
  })
  it('knows open-format technician and place files, and falls back to cases', () => {
    expect(guessKind(table(['name', 'skills', 'active'], [['A', 'x', 'yes']]), site)).toBe('technicians')
    expect(guessKind(table(['area', 'latitude', 'longitude'], [['A', '1', '2']]), site)).toBe('places')
    expect(guessKind(table(['Zzz', 'Yyy'], [['a', 'b']]), site)).toBe('cases')
  })
})

describe('field rows', () => {
  const result = suggestProfile(CASES, 'cases', site)
  it('lists needed fields first, then helpful, then optional, with suggestions, choices and samples', () => {
    const rows = fieldRows('cases', CASES, result, result.profile)
    const levels = rows.map((r) => r.level)
    expect(levels).toEqual([...levels].sort((a, b) => ['required', 'recommended', 'optional'].indexOf(a) - ['required', 'recommended', 'optional'].indexOf(b)))
    expect(rows.slice(0, 2).map((r) => r.field)).toEqual(['caseId', 'workType'])
    const id = rows[0]
    expect(id.suggestion?.confidence).toBe(1)
    expect(id.chosen).toEqual(['Ticket No'])
    expect(id.samples).toEqual([['1', '2', '3']])
    expect(rows.find((r) => r.field === 'customerName')?.personal).toBe(true)
    expect(rows.find((r) => r.field === 'notes')?.chosen).toEqual([])
  })
  it('gives distinct sample values, skipping empty cells', () => {
    expect(sampleValues(CASES, 'Priority')).toEqual(['P1', 'P2'])
    expect(sampleValues(CASES, 'Nope')).toEqual([])
  })
  it('adds and removes a column choice without changing the profile it was given', () => {
    const p = blank()
    const withIt = setColumns(p, 'caseId', ['A'])
    expect(withIt.columns).toEqual({ caseId: ['A'] })
    expect(p.columns).toEqual({})
    expect(setColumns(withIt, 'caseId', []).columns).toEqual({})
  })
})

describe('value rows', () => {
  const profile = { ...suggestProfile(CASES, 'cases', site).profile }
  it('counts distinct values, merging spellings, and shows where each goes now', () => {
    const rows = valueRows(CASES, profile, site, 'workType')
    expect(rows).toEqual([
      { source: 'AC Repair', count: 2, target: null },
      { source: 'Cleaning', count: 1, target: null },
      { source: 'Installation', count: 1, target: 'Installation' },
    ])
  })
  it('uses the profile map and level names for priority and status', () => {
    const p = setValue(setValue(profile, 'priority', 'P1', 'Escalated'), 'status', 'Pending', 'hold')
    expect(valueRows(CASES, p, site, 'priority').map((r) => [r.source, r.target])).toEqual([['P1', 'Escalated'], ['P2', null]])
    expect(valueRows(CASES, p, site, 'status').map((r) => [r.source, r.count, r.target])).toEqual([['Open', 3, null], ['Pending', 1, 'hold']])
  })
  it('splits skill cells into single skills', () => {
    const t = table(['Name', 'Skills'], [['A', 'Service; Breakdown'], ['B', 'service'], ['C', 'Plumbing']])
    const p = suggestProfile(t, 'technicians', site).profile
    expect(valueRows(t, p, site, 'skill').map((r) => [r.source, r.count, r.target])).toEqual([['Service', 2, 'Service'], ['Breakdown', 1, 'Breakdown'], ['Plumbing', 1, null]])
  })
  it('sets and clears a mapping with normalised keys, without changing its input', () => {
    const p = setValue(profile, 'workType', ' AC  Repair ', 'Service')
    expect(p.valueMaps.workType).toEqual({ 'ac repair': 'Service' })
    expect(profile.valueMaps.workType).toEqual({})
    expect(valueRows(CASES, p, site, 'workType')[0].target).toBe('Service')
    expect(setValue(p, 'workType', 'AC repair', null).valueMaps.workType).toEqual({})
  })
  it('offers the site options in plain words', () => {
    expect(valueOptions(site, 'workType').map((o) => o.value)).toEqual(['Installation', 'Service', 'Breakdown'])
    expect(valueOptions(site, 'priority').map((o) => o.value)).toEqual(['Normal', 'Escalated'])
    expect(valueOptions(site, 'skill').map((o) => o.value)).toEqual(['Installation', 'Service', 'Breakdown'])
    expect(valueOptions(site, 'status')).toEqual([{ value: 'schedule', label: 'Plan it' }, { value: 'hold', label: 'Hold it' }, { value: 'ignore', label: 'Ignore it' }])
  })
  it('lists only the value fields whose column is chosen', () => {
    expect(valueFields('cases', blank())).toEqual([])
    expect(valueFields('cases', setColumns(setColumns(blank(), 'workType', ['Category']), 'priority', ['Priority']))).toEqual(['workType', 'priority'])
    expect(valueFields('technicians', setColumns(blank('technicians'), 'skills', ['Skills']))).toEqual(['skill'])
    expect(valueFields('places', blank('places'))).toEqual([])
  })
})

describe('canContinue', () => {
  const ctx = (profile: MappingProfile, kind: MappingProfile['kind'] = 'cases', leave = false) => ({ kind, profile, table: CASES, site, leaveInReview: leave })
  it('needs a file first', () => {
    expect(canContinue('file', { ...ctx(blank()), table: null })).toEqual({ ok: false, reason: 'Choose a file first.' })
    expect(canContinue('file', ctx(blank())).ok).toBe(true)
  })
  it('needs the required columns and one place column for cases', () => {
    expect(canContinue('columns', ctx(blank())).reason).toBe('Choose a column for "Case identifier".')
    const id = setColumns(blank(), 'caseId', ['Ticket No'])
    expect(canContinue('columns', ctx(id)).reason).toBe('Choose a column for "Work type".')
    const wt = setColumns(id, 'workType', ['Category'])
    expect(canContinue('columns', ctx(wt)).reason).toContain('at least one place column')
    expect(canContinue('columns', ctx(setColumns(wt, 'area', ['Locality']))).ok).toBe(true)
    expect(canContinue('columns', ctx(setColumns(wt, 'postalCode', ['x']))).ok).toBe(true)
    expect(canContinue('columns', ctx(setColumns(setColumns(wt, 'latitude', ['a']), 'longitude', ['b']))).ok).toBe(true)
    expect(canContinue('columns', ctx(setColumns(wt, 'latitude', ['a']))).reason).toContain('both a latitude and a longitude')
  })
  it('accepts one work type for the whole file instead of a category column', () => {
    const p = { ...setColumns(setColumns(blank(), 'caseId', ['Ticket No']), 'area', ['Locality']), singleWorkType: 'Service' }
    expect(canContinue('columns', ctx(p)).ok).toBe(true)
  })
  it('needs name and skills for technicians, and name and coordinates for places', () => {
    expect(canContinue('columns', ctx(blank('technicians'), 'technicians')).reason).toContain('"Name"')
    const t = setColumns(setColumns(blank('technicians'), 'name', ['Name']), 'skills', ['Skills'])
    expect(canContinue('columns', ctx(t, 'technicians')).ok).toBe(true)
    expect(canContinue('columns', ctx(blank('places'), 'places')).reason).toContain('"Place name"')
  })
  it('holds the Values step until every category has a work type, unless the user leaves them in review', () => {
    const p = setColumns(blank(), 'workType', ['Category'])
    expect(canContinue('values', ctx(p)).reason).toBe('2 categories are not matched to a work type yet.')
    const one = setValue(setValue(p, 'workType', 'AC repair', 'Service'), 'workType', 'Cleaning', 'Service')
    expect(canContinue('values', ctx(one)).ok).toBe(true)
    expect(canContinue('values', ctx(setValue(p, 'workType', 'AC repair', 'Service'))).reason).toBe('1 category is not matched to a work type yet.')
    expect(canContinue('values', ctx(p, 'cases', true)).ok).toBe(true)
  })
  it('lets the check step go on', () => {
    expect(canContinue('check', ctx(blank())).ok).toBe(true)
  })
})

describe('flowReducer', () => {
  const result = suggestProfile(CASES, 'cases', site)
  const loaded = (known: MappingProfile | null = null): FlowState =>
    flowReducer(initialFlow, { type: 'file', table: CASES, fileName: 'f.csv', kind: 'cases', result, known })
  it('loads a file and stays on the file step', () => {
    const s = loaded()
    expect(s).toMatchObject({ step: 'file', fileName: 'f.csv', kind: 'cases', knownProfile: false })
    expect(s.profile).toEqual(result.profile)
  })
  it('goes file, columns, values, check, and back the same way', () => {
    let s = loaded()
    s = flowReducer(s, { type: 'next' })
    expect(s.step).toBe('columns')
    s = flowReducer(s, { type: 'next' })
    expect(s.step).toBe('values') // work type, status and priority columns are chosen
    s = flowReducer(s, { type: 'next' })
    expect(s.step).toBe('check')
    s = flowReducer(s, { type: 'back' })
    expect(s.step).toBe('values')
    s = flowReducer(s, { type: 'back' })
    expect(s.step).toBe('columns')
    s = flowReducer(s, { type: 'back' })
    expect(s.step).toBe('file')
    expect(flowReducer(s, { type: 'back' }).step).toBe('file')
  })
  it('skips the values step when no value column is chosen', () => {
    let s = loaded()
    for (const f of ['workType', 'status', 'priority']) s = flowReducer(s, { type: 'columns', field: f, headers: [] })
    s = flowReducer(flowReducer(s, { type: 'next' }), { type: 'next' })
    expect(s.step).toBe('check')
    expect(flowReducer(s, { type: 'back' }).step).toBe('columns')
  })
  it('skips columns and values for a layout it knows', () => {
    const known = { ...blank(), fingerprint: 'k', name: 'saved' }
    let s = loaded(known)
    expect(s.knownProfile).toBe(true)
    expect(s.profile).toBe(known)
    s = flowReducer(s, { type: 'next' })
    expect(s.step).toBe('check')
    expect(flowReducer(s, { type: 'back' }).step).toBe('file')
  })
  it('updates the profile without changing the old one', () => {
    const s = loaded()
    const next = flowReducer(s, { type: 'columns', field: 'notes', headers: ['Status'] })
    expect(next.profile?.columns.notes).toEqual(['Status'])
    expect(s.profile?.columns.notes).toBeUndefined()
    expect(flowReducer(next, { type: 'dateOrder', order: 'dmy' }).profile?.formats.dateOrder).toBe('dmy')
    expect(flowReducer(next, { type: 'value', field: 'workType', source: 'Cleaning', target: 'Service' }).profile?.valueMaps.workType).toEqual({ cleaning: 'Service' })
    const single = flowReducer(next, { type: 'singleWorkType', name: 'Service' })
    expect(single.profile?.singleWorkType).toBe('Service')
    expect(flowReducer(single, { type: 'singleWorkType', name: null }).profile?.singleWorkType).toBeUndefined()
    expect(flowReducer(next, { type: 'leaveInReview', on: true }).leaveInReview).toBe(true)
  })
  it('changes the kind, ends, reports errors and resets', () => {
    const s = loaded()
    const t = suggestProfile(CASES, 'technicians', site)
    expect(flowReducer(s, { type: 'kind', kind: 'technicians', result: t })).toMatchObject({ kind: 'technicians', knownProfile: false })
    expect(flowReducer(s, { type: 'imported' }).step).toBe('done')
    expect(flowReducer(s, { type: 'error', message: 'Bad file' }).error).toBe('Bad file')
    expect(flowReducer(s, { type: 'reset' })).toEqual(initialFlow)
  })
  it('does nothing before a file is loaded', () => {
    expect(flowReducer(initialFlow, { type: 'next' })).toBe(initialFlow)
    expect(flowReducer(initialFlow, { type: 'back' })).toBe(initialFlow)
    expect(flowReducer(initialFlow, { type: 'columns', field: 'a', headers: ['b'] })).toBe(initialFlow)
  })
})

describe('describeTable', () => {
  it('says what was found in plain words', () => {
    expect(describeTable(CASES)).toBe('UTF-8, comma-separated, header on row 1, 4 rows')
    const euro = buildTable([['Id', 'Ort'], ['1', 'Köln']], { format: 'csv', fileName: 'f.csv', sheets: [], sheet: '', encoding: 'windows-1252', encodingConfident: false, delimiter: ';', delimiterConfident: true })
    expect(describeTable(euro)).toBe('Windows-1252 (Western European), semicolon-separated, header on row 1, 1 row')
    const xl = buildTable([['Id'], ['1']], { format: 'xlsx', fileName: 'f.xlsx', sheets: ['A', 'Data'], sheet: 'Data', encoding: 'xlsx', encodingConfident: true, delimiter: null, delimiterConfident: true })
    expect(describeTable(xl)).toBe('Excel sheet "Data", header on row 1, 1 row')
    const js = buildTable([['id'], ['1'], ['2']], { format: 'json', fileName: 'f.json', sheets: [], sheet: '', encoding: 'utf-8', encodingConfident: true, delimiter: null, delimiterConfident: true })
    expect(describeTable(js)).toBe('JSON, 2 rows')
  })
})

describe('dateReadings', () => {
  it('writes out both readings of an ambiguous date', () => {
    expect(dateReadings('04/05/2026')).toEqual({ dmy: '4 May 2026', mdy: '5 April 2026' })
    expect(dateReadings('06.07.26')).toEqual({ dmy: '6 July 2026', mdy: '7 June 2026' })
  })
  it('gives nothing when the date is not ambiguous or not numeric', () => {
    for (const v of ['13/05/2026', '05/13/2026', '2026-05-04', 'May 4', '', '00/05/2026']) expect(dateReadings(v)).toBeNull()
  })
})

describe('kind change with a saved mapping', () => {
  it('uses the saved mapping for the new kind when there is one', () => {
    const s = flowReducer(initialFlow, { type: 'file', table: CASES, fileName: 'f.csv', kind: 'cases', result: suggestProfile(CASES, 'cases', site), known: null })
    const t = suggestProfile(CASES, 'technicians', site)
    const known = { ...blank('technicians'), name: 'saved' }
    const next = flowReducer(s, { type: 'kind', kind: 'technicians', result: t, known })
    expect(next.knownProfile).toBe(true)
    expect(next.profile).toBe(known)
  })
})
