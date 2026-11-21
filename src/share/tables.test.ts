import { describe, expect, it } from 'vitest'
import { plan } from '../engine/index'
import type { StoredCase } from '../intake/import/merge'
import { summarise } from '../demo/viewModel'
import { prepare } from '../screens/plan/planData'
import { emptyWorkspace, type Workspace } from '../workspace/workspace'
import { buildTables, type Table } from './tables'

const TODAY = '2026-10-13'
const stored = (id: string, over: Partial<StoredCase> = {}): StoredCase => ({
  caseId: id, workTypeName: 'Service', place: 'North', state: 'active', reportedAt: '2026-10-10', overrides: {},
  firstImported: '2026-10-13', lastImported: '2026-10-13', ...over,
})
function ready(): Workspace {
  const w = emptyWorkspace()
  return {
    ...w,
    site: { ...w.site, name: 'Test centre', places: [{ name: 'North', latitude: 20.1, longitude: 30.05 }, { name: 'South', latitude: 19.95, longitude: 30.1 }] },
    technicians: [{ name: 'Ann', skills: ['Service'], active: true }, { name: 'Bo', skills: ['Service'], active: true }],
    cases: [stored('10'), stored('9'), stored('100', { place: 'South' })],
  }
}

function tablesFor(w: Workspace): { tables: Table[]; summary: ReturnType<typeof summarise> } {
  const p = prepare(w, TODAY)
  if (!p.ok) throw new Error(p.text)
  const result = plan(p.input)
  return { tables: buildTables(w, p, result, '2026-10-13'), summary: summarise(p.input, result) }
}
const named = (tables: Table[], name: string): Table => {
  const t = tables.find((x) => x.name === name)
  if (t === undefined) throw new Error('no table ' + name)
  return t
}
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

describe('buildTables', () => {
  it('gives the five tables in a fixed order', () => {
    expect(tablesFor(ready()).tables.map((t) => t.name)).toEqual(['Schedule', 'Day routes', 'Not planned', 'Summary', 'Change log'])
  })

  it('writes one schedule row per planned case, with names instead of numbers, sorted by day, technician and visit', () => {
    const t = named(tablesFor(ready()).tables, 'Schedule')
    expect(t.headers).toEqual(['Case', 'Work type', 'Place', 'Date', 'Weekday', 'Technician', 'Visit', 'Arrival', 'Driving minutes', 'Kilometres', 'Reason', 'Flag'])
    expect(t.rows.map((r) => r[0]).sort()).toEqual(['10', '100', '9'])
    for (const r of t.rows) {
      expect(r[1]).toBe('Service')
      expect(['North', 'South']).toContain(r[2])
      expect(r[3]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(WEEKDAYS).toContain(r[4])
      expect(['Ann', 'Bo']).toContain(r[5])
      expect(typeof r[6]).toBe('number')
      expect(r[7]).toMatch(/^\d{2}:\d{2}$/)
      expect(typeof r[8]).toBe('number')
      expect(typeof r[9]).toBe('number')
    }
    const key = (r: (string | number)[]) => `${r[3]}|${r[5]}|${String(r[6]).padStart(3, '0')}`
    expect(t.rows.map(key)).toEqual([...t.rows.map(key)].sort())
  })

  it('names the weekday of the date it writes', () => {
    const t = named(tablesFor(ready()).tables, 'Schedule')
    expect(t.rows[0][3]).toBe('2026-10-13')
    expect(t.rows[0][4]).toBe('Tuesday')
  })

  it('lists each route of a day with its stops in order, leaving out empty routes', () => {
    const { tables, summary } = tablesFor(ready())
    const t = named(tables, 'Day routes')
    expect(t.headers).toEqual(['Date', 'Technician', 'Visits', 'Stops in order', 'Driving minutes', 'On-site minutes'])
    expect(t.rows.reduce((n, r) => n + (r[2] as number), 0)).toBe(summary.scheduled)
    for (const r of t.rows) {
      expect(r[2]).toBeGreaterThan(0)
      expect(String(r[3]).split(' > ')).toHaveLength(r[2] as number)
    }
  })

  it('lists what the engine could not plan, then the cases that were held back, each with its reason', () => {
    const w = { ...ready(), cases: [...ready().cases, stored('h1', { state: 'hold' }), stored('r1', { state: 'review' }), stored('np', { place: undefined }), stored('d1', { state: 'done' })] }
    const rows = named(tablesFor(w).tables, 'Not planned').rows
    expect(named(tablesFor(w).tables, 'Not planned').headers).toEqual(['Case', 'Reason'])
    expect(rows).toContainEqual(['h1', 'On hold'])
    expect(rows).toContainEqual(['r1', 'Needs review'])
    expect(rows).toContainEqual(['np', 'The place or work type is not known'])
    expect(rows.map((r) => r[0])).not.toContain('d1')
  })

  it('gives the planner’s own reason for a case it could not place', () => {
    const w = { ...ready(), technicians: ready().technicians.map((t) => ({ ...t, skills: [] })) }
    const { tables } = tablesFor(w)
    expect(named(tables, 'Schedule').rows).toEqual([])
    expect(named(tables, 'Not planned').rows).toContainEqual(['10', 'No active technician has this skill'])
  })

  it('sums the plan up in rows of item and value', () => {
    const { tables, summary } = tablesFor(ready())
    const t = named(tables, 'Summary')
    expect(t.headers).toEqual(['Item', 'Value'])
    const get = (item: string) => t.rows.find((r) => r[0] === item)?.[1]
    expect(get('Cases planned')).toBe(summary.scheduled)
    expect(get('Cases not planned')).toBe(summary.unscheduled)
    expect(get('Working days')).toBe(summary.days)
    expect(get('Technicians working')).toBe(summary.techniciansUsed)
    expect(get('Technicians in total')).toBe(2)
    expect(get('Driving hours')).toBe(summary.travelHours)
    expect(get('On-site hours')).toBe(summary.onSiteHours)
    expect(get('First day')).toBe('2026-10-13')
    expect(get('Centre')).toBe('Test centre')
    expect(get('Made on')).toBe('2026-10-13')
  })

  it('copies the change log of the imports', () => {
    const w = { ...ready(), changes: [{ caseId: '10', field: 'place', previous: 'North', next: 'South', reason: 'The new file says so' }] }
    const t = named(tablesFor(w).tables, 'Change log')
    expect(t.headers).toEqual(['Case', 'Field', 'Before', 'After', 'Reason'])
    expect(t.rows).toEqual([['10', 'place', 'North', 'South', 'The new file says so']])
    expect(named(tablesFor(ready()).tables, 'Change log').rows).toEqual([])
  })
})
