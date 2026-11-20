import { describe, expect, it } from 'vitest'
import { plan } from './index'
import { compareResults } from './testing/compare'
import { START, testInput } from './testing/fixtures'
import type { PlanResult } from './types'

function sample(): PlanResult {
  const cases = ['1', '2', '3'].map((id) => ({ id, workType: 0, place: 0, escalated: false, reportedDay: START }))
  return plan(testInput({
    places: [{ name: 'Here', lat: 20, lon: 30 }],
    technicians: [{ name: 'T', skills: [0], active: true }],
    cases,
  }))
}

describe('compareResults (the golden test can only be trusted if this catches differences)', () => {
  it('finds nothing between a result and a copy of itself', () => {
    expect(compareResults(sample(), structuredClone(sample()))).toEqual([])
  })

  it('allows real numbers to differ in the last digits only', () => {
    const changed = structuredClone(sample())
    changed.scheduled[0].travelMin += 1e-12
    expect(compareResults(changed, sample())).toEqual([])
    changed.scheduled[0].travelMin += 0.001
    expect(compareResults(changed, sample()).length).toBeGreaterThan(0)
  })

  it.each([
    ['technician', (r: PlanResult) => { r.scheduled[0].tech += 1 }],
    ['day', (r: PlanResult) => { r.scheduled[1].day += 1 }],
    ['visit number', (r: PlanResult) => { r.scheduled[2].visit += 1 }],
    ['arrival time', (r: PlanResult) => { r.scheduled[0].eta = '09:06' }],
    ['reason text', (r: PlanResult) => { r.scheduled[0].why += '!' }],
    ['flag', (r: PlanResult) => { r.scheduled[0].flag = 'OVER CAPACITY' }],
    ['a missing case', (r: PlanResult) => { r.scheduled.pop() }],
    ['an unscheduled case', (r: PlanResult) => { r.unscheduled.push({ id: '9', reason: 'x' }) }],
    ['the list of days', (r: PlanResult) => { r.days.push(99) }],
    ['the stop order of a route', (r: PlanResult) => { r.routes[0].stops.reverse() }],
    ['a route load', (r: PlanResult) => { r.routes[0].load += 0.5 }],
  ])('catches a change in %s', (_label, mutate) => {
    const changed = structuredClone(sample())
    mutate(changed)
    expect(compareResults(changed, sample()).length).toBeGreaterThan(0)
  })
})
