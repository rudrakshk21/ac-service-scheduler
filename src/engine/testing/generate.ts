import type { CaseIn, PlanInput, Technician } from '../types'
import { START, testSettings, WORK_TYPES } from './fixtures'

/** Small seeded random number generator (mulberry32), values in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A random planning input without manual pins. The same seed always gives the same input.
 * With `extended`, the step 2 features are used at random: start and end places, own working hours, priority
 * levels, due dates, product types and own visit minutes. Without it the draws are exactly those of step 1.
 */
export function generateInput(seed: number, nPlaces: number, nTechs: number, nCases: number, extended = false): PlanInput {
  const r = rng(seed)
  const int = (a: number, b: number): number => a + Math.floor(r() * (b - a + 1))
  const places = Array.from({ length: nPlaces }, (_, i) => ({
    name: `Place ${i + 1}`,
    lat: 20 + (r() - 0.5) * 0.5,
    lon: 30 + (r() - 0.5) * 0.5,
  }))
  const technicians = Array.from({ length: nTechs }, (_, i): Technician => {
    const t: Technician = { name: `Technician ${i + 1}`, skills: [i % 3], active: r() > 0.15 }
    if (r() < 0.2) {
      const from = START + int(0, 3)
      t.leaveFrom = from
      t.leaveTo = from + int(0, 3)
    }
    return t
  })
  const cases = Array.from({ length: nCases }, (_, i): CaseIn => ({
    id: String(100001 + i),
    workType: int(0, 2),
    place: int(0, nPlaces - 1),
    escalated: r() < 0.05,
    reportedDay: START - int(0, 40),
  }))
  let productTypes: PlanInput['productTypes']
  let priorityLevels: PlanInput['settings']['priorityLevels']
  if (extended) {
    priorityLevels = [
      { name: 'Low', weight: 0 },
      { name: 'High', weight: 150 },
      { name: 'Emergency', weight: 100000 },
    ]
    productTypes = [{ name: 'Split' }, { name: 'Cassette', addMin: 30 }, { name: 'Ducted', factor: 1.5, addMin: 15 }]
    for (const t of technicians) {
      if (r() < 0.3) t.startPlace = int(0, nPlaces - 1)
      if (r() < 0.3) t.endPlace = int(0, nPlaces - 1)
      if (r() < 0.3) t.usableMin = int(240, 480)
      if (r() < 0.3) t.dayStartMin = int(480, 600)
      if (r() < 0.2) t.breakMin = int(0, 60)
    }
    for (const c of cases) {
      if (r() < 0.5) c.priority = int(0, 2)
      if (r() < 0.5) c.dueDay = START + int(-3, 10)
      if (r() < 0.4) c.productType = int(0, 2)
      if (r() < 0.1) c.serviceMin = int(20, 90)
    }
  }
  return {
    settings: testSettings({
      horizonDays: int(3, 15),
      holidays: r() < 0.3 ? [START + int(0, 6)] : [],
      restWeekdays: r() < 0.8 ? [6] : [],
      ...(priorityLevels ? { priorityLevels } : {}),
    }),
    workTypes: WORK_TYPES.map((w) => ({ ...w })),
    ...(productTypes ? { productTypes } : {}),
    technicians,
    places,
    cases,
  }
}
