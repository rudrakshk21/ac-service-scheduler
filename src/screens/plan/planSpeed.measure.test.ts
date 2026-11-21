import { describe, it } from 'vitest'
import { plan } from '../../engine/index'
import type { StoredCase } from '../../intake/import/merge'
import { emptyWorkspace, type Workspace } from '../../workspace/workspace'
import { prepare } from './planData'

// Opt-in measurement, skipped in normal runs and in the pipeline:
//   VITE_MEASURE_SPEED=1 npx vitest run src/screens/plan/planSpeed.measure.test.ts
// It plans a made-up centre the way the Plan screen does (workspace, then the plan input, then the engine), so the
// figures can be compared with the same data planned in the browser's worker.

/** The same made-up numbers every time. */
function lcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function centre(nCases: number, nTechs: number, nPlaces: number, horizonDays: number): Workspace {
  const rnd = lcg(20261121)
  const types = ['Installation', 'Service', 'Breakdown']
  const w = emptyWorkspace()
  w.site.name = 'Invented large centre'
  w.site.settings.horizonDays = horizonDays
  w.site.places = Array.from({ length: nPlaces }, (_, i) => ({
    name: `Place ${String(i + 1).padStart(2, '0')}`,
    latitude: Number((20 + (rnd() - 0.5) * 0.6).toFixed(5)),
    longitude: Number((30 + (rnd() - 0.5) * 0.6).toFixed(5)),
  }))
  w.technicians = Array.from({ length: nTechs }, (_, i) => ({
    name: `Technician ${String(i + 1).padStart(3, '0')}`,
    skills: [types[i % 3], types[(i + 1) % 3]],
    active: true,
  }))
  w.cases = Array.from({ length: nCases }, (_, i): StoredCase => {
    const p = w.site.places[Math.floor(rnd() * nPlaces)]
    const workType = types[Math.floor(rnd() * 3)]
    const day = 1 + Math.floor(rnd() * 28)
    return {
      caseId: String(400001 + i), workType, workTypeName: workType, latitude: p.latitude, longitude: p.longitude,
      area: `Area ${1 + (i % 12)}`, place: p.name, reportedAt: `2026-11-${String(day).padStart(2, '0')}`,
      priorityLevel: rnd() < 0.03 ? 'Escalated' : 'Normal', state: 'active', overrides: {},
      firstImported: '2026-11-20', lastImported: '2026-11-20',
    }
  })
  return w
}

describe.skipIf(import.meta.env.VITE_MEASURE_SPEED !== '1')('the Plan screen at the target size (NFR-4)', () => {
  // [cases, technicians, places, horizon in working days]
  const sizes = [[500, 30, 40, 30], [1000, 60, 50, 30], [2000, 100, 60, 30], [2000, 25, 60, 30], [5000, 200, 80, 30], [10000, 300, 100, 30]] as const
  for (const [nCases, nTechs, nPlaces, horizon] of sizes) {
    it(`measures ${nCases} cases, ${nTechs} technicians, ${nPlaces} places, horizon ${horizon}`, () => {
      const w = centre(nCases, nTechs, nPlaces, horizon)
      const t0 = performance.now()
      const prepared = prepare(w, '2026-11-21')
      const t1 = performance.now()
      if (!prepared.ok) throw new Error(prepared.text)
      const result = plan(prepared.input)
      const t2 = performance.now()
      console.log(
        `SPEED: ${nCases} cases, ${nTechs} technicians, horizon ${horizon}: prepare ${(t1 - t0).toFixed(0)} ms, plan ${((t2 - t1) / 1000).toFixed(2)} s, ` +
          `${result.scheduled.length} scheduled, ${result.unscheduled.length} unscheduled, ${result.days.length} days planned`,
      )
    }, 900_000)
  }
})
