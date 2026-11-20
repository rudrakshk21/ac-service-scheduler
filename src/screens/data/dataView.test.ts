import { describe, expect, it } from 'vitest'
import type { StoredCase } from '../../intake/import/merge'
import { starterSite } from '../../intake/site/starter'
import { countsByState, exceptionQueue, filterCases, stateLabel, STATE_ORDER, techniciansView, workTypeIndex } from './dataView'

const c = (id: string, over: Partial<StoredCase> = {}): StoredCase => ({
  caseId: id, state: 'active', workTypeName: 'Service', workType: 'AC Repair', place: 'North Town', area: 'North Town', overrides: {},
  firstImported: '2026-10-13', lastImported: '2026-10-13', ...over,
})
const CASES = [
  c('100001'), c('100002', { state: 'hold', status: 'Pending Parts', workTypeName: 'Installation', workType: 'New Unit', place: 'Köln' }),
  c('100003', { state: 'review', workTypeName: undefined, workType: 'Cleaning' }), c('100004', { state: 'ignored' }),
  c('100005', { state: 'done' }), c('100006', { state: 'closed' }), c('100007', { place: undefined, area: 'Nowhere', postalCode: '999' }),
]

describe('counts and labels', () => {
  it('counts every state and the counts add up', () => {
    const n = countsByState(CASES)
    expect(n).toEqual({ active: 2, hold: 1, review: 1, ignored: 1, done: 1, closed: 1 })
    expect(Object.values(n).reduce((a, b) => a + b, 0)).toBe(CASES.length)
  })
  it('has a plain label for each state, in a fixed order', () => {
    expect(STATE_ORDER.map(stateLabel)).toEqual(['Ready to plan', 'On hold', 'Needs review', 'Ignored', 'Done', 'Closed'])
  })
})

describe('filterCases', () => {
  it('filters by state and by every word of the query, ignoring case and accents', () => {
    expect(filterCases(CASES, { state: 'all', query: '' })).toHaveLength(7)
    expect(filterCases(CASES, { state: 'hold', query: '' }).map((x) => x.caseId)).toEqual(['100002'])
    expect(filterCases(CASES, { state: 'all', query: 'koln' }).map((x) => x.caseId)).toEqual(['100002'])
    expect(filterCases(CASES, { state: 'all', query: 'ac  REPAIR north' }).map((x) => x.caseId)).toEqual(['100001', '100004', '100005', '100006'])
    expect(filterCases(CASES, { state: 'active', query: 'north repair' }).map((x) => x.caseId)).toEqual(['100001'])
    expect(filterCases(CASES, { state: 'all', query: 'pending' }).map((x) => x.caseId)).toEqual(['100002'])
    expect(filterCases(CASES, { state: 'all', query: '100003' }).map((x) => x.caseId)).toEqual(['100003'])
    expect(filterCases(CASES, { state: 'all', query: 'zzz' })).toEqual([])
  })
})

describe('exceptionQueue', () => {
  it('lists review cases and open cases with no place, but not finished ones', () => {
    expect(exceptionQueue(CASES)).toEqual([
      { caseId: '100003', issue: 'review', detail: 'The category “Cleaning” is not matched to a work type.' },
      { caseId: '100007', issue: 'no_location', detail: 'The place (Nowhere / 999) is not in your place table.' },
    ])
  })
  it('says so when the file gave no place at all, and skips closed, ignored and done cases', () => {
    const none = c('9', { place: undefined, area: undefined })
    expect(exceptionQueue([none])[0].detail).toBe('The file gave no place.')
    expect(exceptionQueue([c('1', { place: undefined, state: 'closed' }), c('2', { place: undefined, state: 'ignored' }), c('3', { place: undefined, state: 'done' })])).toEqual([])
  })
})

describe('workTypeIndex and techniciansView', () => {
  it('finds the position of a work type, or -1', () => {
    const wt = starterSite().workTypes
    expect(workTypeIndex('Breakdown', wt)).toBe(2)
    expect(workTypeIndex('Nope', wt)).toBe(-1)
    expect(workTypeIndex(undefined, wt)).toBe(-1)
  })
  it('describes technicians in plain words', () => {
    expect(techniciansView([
      { name: 'Ann', skills: ['Service', 'Breakdown'], active: true },
      { name: 'Bo', skills: [], active: false, leaveFrom: '2026-10-20', leaveTo: '2026-10-22' },
      { name: 'Cy', skills: ['Service'], active: true, leaveFrom: '2026-10-20' },
    ])).toEqual([
      { name: 'Ann', skills: 'Service, Breakdown', status: 'Active', leave: '' },
      { name: 'Bo', skills: 'No skills matched', status: 'Switched off', leave: 'Leave 2026-10-20 to 2026-10-22' },
      { name: 'Cy', skills: 'Service', status: 'Active', leave: 'Leave 2026-10-20' },
    ])
  })
})
