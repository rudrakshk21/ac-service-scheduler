import { describe, expect, it } from 'vitest'
import { dayNumber } from '../engine/calendar'
import { plan } from '../engine'
import type { PlanInput, PlanResult, ScheduledCase } from '../engine'
import { START, testInput } from '../engine/testing/fixtures'
import { dayAxis, dayLabel, daysWithVisits, lanesForDay, movedCases, summarise } from './viewModel'

const here = { name: 'Here', lat: 20, lon: 30 } // exactly at the base

function threeInstalls(): PlanInput {
  return testInput({
    places: [here],
    technicians: [
      { name: 'Technician 01', skills: [0], active: true },
      { name: 'Technician 02', skills: [1], active: false },
    ],
    cases: ['1', '2', '3'].map((id) => ({ id, workType: 0, place: 0, escalated: false, reportedDay: START })),
  })
}

describe('summarise', () => {
  it('counts cases, days, technicians and hours', () => {
    const input = threeInstalls()
    const s = summarise(input, plan(input))
    expect(s).toEqual({
      scheduled: 3, unscheduled: 0, days: 1, techniciansUsed: 1, techniciansTotal: 2, travelHours: 0.5, onSiteHours: 6,
    })
  })
})

describe('lanesForDay', () => {
  it('lists every technician, with blocks for travel, the lunch break and work', () => {
    const input = threeInstalls()
    const lanes = lanesForDay(input, plan(input), START)
    expect(lanes.map((l) => l.name)).toEqual(['Technician 01', 'Technician 02'])
    expect(lanes[1].active).toBe(false)
    expect(lanes[1].blocks).toEqual([])

    const lane = lanes[0]
    expect(lane.stops.map((s) => [s.visit, s.eta])).toEqual([[1, '09:05'], [2, '11:15'], [3, '14:25']])
    expect(lane.blocks).toEqual([
      { kind: 'travel', startMin: 540, endMin: 545 },
      { kind: 'work', startMin: 545, endMin: 665, workType: 0 },
      { kind: 'travel', startMin: 665, endMin: 675 },
      { kind: 'work', startMin: 675, endMin: 795, workType: 0 },
      { kind: 'travel', startMin: 795, endMin: 805 },
      { kind: 'break', startMin: 805, endMin: 865 },
      { kind: 'work', startMin: 865, endMin: 985, workType: 0 },
      { kind: 'travel', startMin: 985, endMin: 990 },
    ])
    expect(lane.travelMin).toBe(30)
    expect(lane.serviceMin).toBe(360)
    expect(lane.endMin).toBe(990)
  })

  it('describes each stop in words', () => {
    const input = threeInstalls()
    const stop = lanesForDay(input, plan(input), START)[0].stops[0]
    expect(stop).toMatchObject({ place: 'Here', workTypeName: 'Installation', serviceMin: 120, travelMin: 5, flag: '' })
    expect(['1', '2', '3']).toContain(stop.id) // the three cases tie, so the engine's tie rule picks the order
    expect(stop.why).toContain('Technician 01')
  })

  it('gives an empty lane on a day without visits', () => {
    const input = threeInstalls()
    const lanes = lanesForDay(input, plan(input), START + 1)
    expect(lanes.every((l) => l.blocks.length === 0 && l.stops.length === 0)).toBe(true)
  })
})

describe('dayAxis', () => {
  it('runs from the start hour to the hour after the last block', () => {
    const input = threeInstalls()
    const axis = dayAxis(input, lanesForDay(input, plan(input), START))
    expect(axis.startMin).toBe(540)
    expect(axis.endMin).toBe(1080) // 540 + 480 + 60 = 18:00; the last block ends at 16:30
    expect(axis.ticks).toEqual([540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080])
  })
})

describe('dayLabel and daysWithVisits', () => {
  it('labels a day number', () => {
    expect(dayLabel(dayNumber('2026-10-13'))).toEqual({ weekday: 'Tue', date: '13 Oct' })
    expect(dayLabel(dayNumber('2026-10-19'))).toEqual({ weekday: 'Mon', date: '19 Oct' })
  })
  it('counts the visits of each planned day', () => {
    const input = threeInstalls()
    const days = daysWithVisits(plan(input))
    expect(days).toEqual([{ day: START, weekday: 'Tue', date: '13 Oct', visits: 3 }])
  })
})

describe('movedCases', () => {
  const scheduled = (id: string, day: number, tech: number): ScheduledCase => ({
    id, day, tech, visit: 1, eta: '09:00', travelMin: 0, prevKm: 0, why: 'x', flag: '',
  })
  const result = (scheduledCases: ScheduledCase[], unscheduledIds: string[]): PlanResult => ({
    scheduled: scheduledCases,
    unscheduled: unscheduledIds.map((id) => ({ id, reason: 'x' })),
    days: [], routes: [],
  })

  it('counts changes of technician or day, and cases that gained or lost a place in the plan', () => {
    const prev = result([scheduled('A', 1, 0), scheduled('B', 1, 0), scheduled('D', 1, 2)], ['C'])
    const next = result([scheduled('A', 1, 1), scheduled('B', 1, 0), scheduled('C', 2, 1)], ['D'])
    const change = movedCases(prev, next)
    expect(change.moved).toBe(3) // A changed technician, C became scheduled, D became unscheduled
    expect([...change.techs].sort()).toEqual([0, 1, 2]) // every technician who lost or gained a case
  })

  it('finds nothing between a plan and itself', () => {
    const r = result([scheduled('A', 1, 0)], [])
    expect(movedCases(r, r)).toEqual({ moved: 0, techs: new Set() })
  })
})
