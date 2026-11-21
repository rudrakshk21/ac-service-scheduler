import { describe, expect, it } from 'vitest'
import { plan } from './index'
import { generateInput } from './testing/generate'
import type { PlanInput, PlanResult } from './types'

// A fingerprint of the plan for a spread of made-up centres: who goes where, on which day, in which order and when,
// and what was left out. Only whole numbers and text are used, so the fingerprint is the same on every machine.
// The golden files compare the engine with the Python reference; these add many more shapes (more technicians, two
// skills each, many cases) so that a change that is meant to be only faster can show that nothing moved.
// To print the fingerprints again after an intended change of the plans:  VITE_PRINT_FINGERPRINTS=1 npx vitest run src/engine/fingerprint.test.ts

/** The first 8 bytes of the SHA-256 of what the plan decided, in hex. */
async function fingerprint(r: PlanResult): Promise<string> {
  const lines = [
    ...r.scheduled.map((s) => `S ${s.id} ${s.day} ${s.tech} ${s.visit} ${s.eta}`),
    ...r.unscheduled.map((u) => `U ${u.id} ${u.reason}`),
    `D ${r.days.join(',')}`,
    ...r.routes.map((x) => `R ${x.day} ${x.tech} ${x.stops.join(',')}`),
  ]
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(lines.join('\n'))))
  return Array.from(digest.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
}

interface Shape {
  seed: number
  places: number
  techs: number
  cases: number
  extended: boolean
  /** Every technician can do two of the three work types, as in most real centres. */
  twoSkills: boolean
  horizon?: number
}

function build(s: Shape): PlanInput {
  const input = generateInput(s.seed, s.places, s.techs, s.cases, s.extended)
  if (s.twoSkills) input.technicians.forEach((t, i) => { t.skills = [i % 3, (i + 1) % 3] })
  if (s.horizon !== undefined) input.settings.horizonDays = s.horizon
  return input
}

const shapes: Shape[] = [
  { seed: 1, places: 8, techs: 3, cases: 20, extended: false, twoSkills: false },
  { seed: 2, places: 10, techs: 5, cases: 60, extended: false, twoSkills: false },
  { seed: 3, places: 12, techs: 6, cases: 120, extended: true, twoSkills: false },
  { seed: 4, places: 12, techs: 6, cases: 120, extended: true, twoSkills: true },
  { seed: 5, places: 20, techs: 10, cases: 200, extended: false, twoSkills: true },
  { seed: 6, places: 20, techs: 10, cases: 200, extended: true, twoSkills: true },
  { seed: 7, places: 30, techs: 15, cases: 300, extended: true, twoSkills: false },
  { seed: 8, places: 30, techs: 15, cases: 300, extended: true, twoSkills: true },
  { seed: 9, places: 6, techs: 2, cases: 150, extended: false, twoSkills: false, horizon: 5 },
  { seed: 10, places: 6, techs: 2, cases: 150, extended: true, twoSkills: true, horizon: 5 },
  { seed: 11, places: 40, techs: 25, cases: 400, extended: true, twoSkills: true },
  { seed: 12, places: 40, techs: 25, cases: 400, extended: false, twoSkills: true, horizon: 10 },
  { seed: 13, places: 3, techs: 4, cases: 80, extended: false, twoSkills: true },
  { seed: 14, places: 50, techs: 30, cases: 500, extended: true, twoSkills: true },
  { seed: 15, places: 5, techs: 8, cases: 30, extended: true, twoSkills: false },
  { seed: 16, places: 25, techs: 12, cases: 250, extended: true, twoSkills: true, horizon: 3 },
  { seed: 17, places: 50, techs: 60, cases: 1000, extended: false, twoSkills: true },
]

// Taken from the engine as it was before the greedy step was made faster.
const expected: string[] = [
  '96c528f52454863a', 'ffbc0d9d00b0c0dc', '05c2a89fc7714a7b', 'a526c732f1d240a3', 'ac643bb4db68d00e', 'c0018bcab7964bff',
  'bffa682d06d594b7', '393713610a611dec', '0867af83da1dc069', '0857b097bfe47403', 'd169a2f45de906f2', '35eec51ba36a507e',
  '4becd9648bbb824a', 'd85f5c15dbacc44b', '29d58602eab67f4f', 'f591cb724af4eec8', 'bc29b41dce8d8e1d',
]

describe('plan fingerprints of made-up centres', () => {
  it.each(shapes.map((s, i) => [i, s] as const))('shape %i gives the same plan as before', async (i, s) => {
    const got = await fingerprint(plan(build(s)))
    if (import.meta.env.VITE_PRINT_FINGERPRINTS === '1') console.log(`FINGERPRINT ${i} ${got}`)
    else expect(got).toBe(expected[i])
  })
})
