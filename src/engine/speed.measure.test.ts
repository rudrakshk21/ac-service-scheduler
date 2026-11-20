import { describe, it } from 'vitest'
import { plan } from './index'
import { generateInput } from './testing/generate'

// Opt-in measurement, skipped in normal runs and in the pipeline:
//   VITE_MEASURE_SPEED=1 npx vitest run src/engine/speed.measure.test.ts
describe.skipIf(import.meta.env.VITE_MEASURE_SPEED !== '1')('planning time at the target size (NFR-4)', () => {
  // [cases, technicians, places, horizon in working days (0 = whatever the generator picks)]
  const sizes = [[500, 30, 40, 0], [1000, 60, 50, 0], [2000, 100, 60, 0], [2000, 100, 60, 30], [2000, 25, 60, 30]] as const
  for (const [nCases, nTechs, nPlaces, horizon] of sizes) {
    it(`measures ${nCases} cases, ${nTechs} technicians, ${nPlaces} places, horizon ${horizon || 'random'}`, () => {
      const input = generateInput(2026, nPlaces, nTechs, nCases, true)
      if (horizon > 0) input.settings.horizonDays = horizon
      const started = performance.now()
      const result = plan(input)
      const seconds = (performance.now() - started) / 1000
      console.log(
        `SPEED: ${nCases} cases, ${nTechs} technicians, horizon ${input.settings.horizonDays}: ` +
          `${result.scheduled.length} scheduled, ${result.unscheduled.length} unscheduled, ` +
          `${result.days.length} days planned, ${seconds.toFixed(2)} s`,
      )
    }, 900_000)
  }
})
