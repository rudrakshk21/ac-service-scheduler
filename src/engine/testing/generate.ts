import type { PlanInput, Technician } from '../types'
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

/** A random planning input without manual pins. The same seed always gives the same input. */
export function generateInput(seed: number, nPlaces: number, nTechs: number, nCases: number): PlanInput {
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
  const cases = Array.from({ length: nCases }, (_, i) => ({
    id: String(100001 + i),
    workType: int(0, 2),
    place: int(0, nPlaces - 1),
    escalated: r() < 0.05,
    reportedDay: START - int(0, 40),
  }))
  return {
    settings: testSettings({
      horizonDays: int(3, 15),
      holidays: r() < 0.3 ? [START + int(0, 6)] : [],
      restWeekdays: r() < 0.8 ? [6] : [],
    }),
    workTypes: WORK_TYPES.map((w) => ({ ...w })),
    technicians,
    places,
    cases,
  }
}
