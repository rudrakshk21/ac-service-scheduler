import { describe, expect, it } from 'vitest'
import { buildContext } from './context'
import { bestInsert, fits, recalc, Route, travelOf } from './route'
import { START, testInput } from './testing/fixtures'

function ctxFor(workTypes: number[]) {
  const places = workTypes.map((_, i) => ({ name: `P${i}`, lat: 20 + i * 0.05, lon: 30 + i * 0.03 }))
  const cases = workTypes.map((w, i) => ({ id: String(i + 1), workType: w, place: i, escalated: false, reportedDay: START }))
  return buildContext(testInput({ places, cases }))
}

describe('travelOf', () => {
  it('is 0 for no stops, base to place and back for one stop', () => {
    const ctx = ctxFor([0, 0])
    const tm = ctx.geo.tm
    expect(travelOf(ctx, [])).toBe(0)
    expect(travelOf(ctx, [0])).toBe(tm[0][1] + tm[1][0])
    expect(travelOf(ctx, [0, 1])).toBe(tm[0][1] + tm[1][2] + tm[2][0])
  })
})

describe('recalc', () => {
  it('sets travel, on-site minutes and the share of the daily ceilings, and bumps the version', () => {
    const ctx = ctxFor([0, 1])
    const r = new Route()
    r.stops = [0, 1]
    recalc(ctx, r)
    expect(r.ver).toBe(1)
    expect(r.service).toBe(120 + 75)
    expect(r.frac).toBe(1 / 3 + 1 / 5)
    expect(r.travel).toBe(travelOf(ctx, [0, 1]))
    recalc(ctx, r)
    expect(r.ver).toBe(2)
  })
})

describe('bestInsert', () => {
  it('costs a round trip for an empty route', () => {
    const ctx = ctxFor([0])
    const { delta, pos } = bestInsert(ctx, new Route(), 0)
    expect(pos).toBe(0)
    expect(delta).toBe(ctx.geo.tm[0][1] + ctx.geo.tm[1][0] - ctx.geo.tm[0][0])
  })
  it('picks the cheapest position: a place between two stops goes between them', () => {
    // A, B and C lie on a north-south line away from the base; B is exactly between A and C.
    const places = [
      { name: 'A', lat: 20, lon: 30.2 },
      { name: 'B', lat: 20.1, lon: 30.2 },
      { name: 'C', lat: 20.2, lon: 30.2 },
    ]
    const cases = places.map((_, i) => ({ id: String(i + 1), workType: 0, place: i, escalated: false, reportedDay: START }))
    const ctx = buildContext(testInput({ places, cases }))
    const r = new Route()
    r.stops = [0, 2] // base, A, C, base
    recalc(ctx, r)
    const { delta, pos } = bestInsert(ctx, r, 1) // insert B
    expect(pos).toBe(1)
    const tm = ctx.geo.tm
    expect(delta).toBe(tm[1][2] + tm[2][3] - tm[1][3])
  })
})

describe('fits', () => {
  it('rejects a case that would pass the usable minutes, accepts one that just fits', () => {
    const ctx = ctxFor([0, 1])
    const r = new Route()
    r.service = 400
    expect(fits(ctx, r, 0, 0)).toBe(false) // 400 + 120 > 480
    expect(fits(ctx, r, 1, 0)).toBe(true) // 400 + 75 <= 480
    expect(fits(ctx, r, 1, 6)).toBe(false) // 6 extra minutes of travel tip it over
  })
  it('rejects a case once the daily ceilings are used up', () => {
    const ctx = ctxFor([0])
    const r = new Route()
    r.frac = 1
    expect(fits(ctx, r, 0, 0)).toBe(false)
    r.frac = 2 / 3
    expect(fits(ctx, r, 0, 0)).toBe(true)
  })
})
