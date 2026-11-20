import { dayNumber } from '../calendar'
import type { PlanInput, Settings, WorkType } from '../types'

/** 2026-10-13, a Tuesday: the plan start used by the reference scenarios. */
export const START = dayNumber('2026-10-13')

export const WORK_TYPES: WorkType[] = [
  { name: 'Installation', serviceMin: 120, dailyCeiling: 3, requiredSkill: 0 },
  { name: 'Service / RMS', serviceMin: 75, dailyCeiling: 5, requiredSkill: 1 },
  { name: 'Breakdown', serviceMin: 75, dailyCeiling: 5, requiredSkill: 2 },
]

/** The defaults of the Python reference engine, with an invented base location. */
export function testSettings(over: Partial<Settings> = {}): Settings {
  return {
    baseLat: 20,
    baseLon: 30,
    speedKmh: 30,
    roadFactor: 1.35,
    sameAreaHopMin: 10,
    usableMin: 480,
    dayStartMin: 540,
    lunchStartMin: 780,
    breakMin: 60,
    ageWeight: 4,
    balanceWeight: 0.05,
    maxKm: 60,
    horizonDays: 30,
    restWeekdays: [6],
    holidays: [],
    startDay: START,
    ...over,
  }
}

export function testInput(over: Partial<PlanInput> = {}): PlanInput {
  return {
    settings: testSettings(),
    workTypes: WORK_TYPES.map((w) => ({ ...w })),
    technicians: [],
    places: [],
    cases: [],
    ...over,
  }
}
