import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { plan } from './index'
import { generateInput } from './testing/generate'
import { checkInvariants } from './testing/invariants'

describe('safety rules hold on random inputs', () => {
  it('INV-1 to INV-6: nothing lost, right skill, within capacity, working days only, same plan twice, every decision explained', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 0, max: 30 }),
        (seed, nPlaces, nTechs, nCases) => {
          const input = generateInput(seed, nPlaces, nTechs, nCases)
          const result = plan(input)
          expect(checkInvariants(input, result)).toEqual([])
          expect(plan(input)).toEqual(result) // INV-5: determinism
        },
      ),
      { numRuns: 200 },
    )
  })

  it('INV-1 to INV-8 also hold when every step 2 feature is in use', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 2, max: 6 }),
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 0, max: 30 }),
        (seed, nPlaces, nTechs, nCases) => {
          const input = generateInput(seed, nPlaces, nTechs, nCases, true)
          const result = plan(input)
          expect(checkInvariants(input, result)).toEqual([])
          expect(plan(input)).toEqual(result) // INV-5: determinism
        },
      ),
      { numRuns: 200 },
    )
  })

  it('catches a planted late flag that is wrong (INV-7) and wrong route minutes (INV-8)', () => {
    const input = generateInput(9, 4, 6, 20, true)
    const result = plan(input)
    expect(checkInvariants(input, result)).toEqual([])
    // A visit that is not late, given a late flag.
    const onTime = result.scheduled.find((s) => (input.cases.find((c) => c.id === s.id)?.dueDay ?? Infinity) >= s.day)
    expect(onTime).toBeDefined()
    const wrongFlag = { ...result, scheduled: result.scheduled.map((s) => (s === onTime ? { ...s, flag: 'LATE BY 1 DAY' } : s)) }
    expect(checkInvariants(input, wrongFlag).some((p) => p.startsWith('INV-7'))).toBe(true)
    const wrongMinutes = { ...result, routes: result.routes.map((r) => ({ ...r, serviceMin: r.serviceMin + 1 })) }
    expect(checkInvariants(input, wrongMinutes).some((p) => p.startsWith('INV-8'))).toBe(true)
  })

  it('catches a planted violation (the checker itself works)', () => {
    const input = generateInput(7, 4, 6, 20)
    const result = plan(input)
    expect(result.scheduled.length).toBeGreaterThan(0)
    const broken = { ...result, scheduled: result.scheduled.map((s, i) => (i === 0 ? { ...s, tech: (s.tech + 1) % 6, why: '' } : s)) }
    expect(checkInvariants(input, broken).length).toBeGreaterThan(0)
  })
})
