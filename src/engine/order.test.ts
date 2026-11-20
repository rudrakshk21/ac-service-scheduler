import { describe, expect, it } from 'vitest'
import { buildContext } from './context'
import { orderRoute } from './order'
import { recalc, Route, travelOf } from './route'
import { generateInput } from './testing/generate'

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs]
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]))
}

function routeOf(stops: number[], ctx: ReturnType<typeof buildContext>): Route {
  const r = new Route()
  r.stops = [...stops]
  recalc(ctx, r)
  return r
}

describe('orderRoute', () => {
  it('leaves routes of 0 or 1 stop alone', () => {
    const ctx = buildContext(generateInput(1, 3, 3, 3))
    const empty = routeOf([], ctx)
    orderRoute(ctx, empty)
    expect(empty.stops).toEqual([])
    const one = routeOf([2], ctx)
    orderRoute(ctx, one)
    expect(one.stops).toEqual([2])
  })

  it('finds the shortest order for up to 7 stops (exact search)', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const ctx = buildContext(generateInput(seed, 7, 3, 7))
      const stops = ctx.cases.map((_, i) => i)
      const r = routeOf([...stops].reverse(), ctx)
      orderRoute(ctx, r)
      const best = Math.min(...permutations(stops).map((p) => travelOf(ctx, p)))
      expect(r.travel).toBeCloseTo(best, 9)
      expect([...r.stops].sort((a, b) => a - b)).toEqual(stops)
    }
  })

  it('never makes a route of more than 10 stops longer, and loses no stop (2-opt)', () => {
    for (const seed of [11, 12, 13]) {
      const ctx = buildContext(generateInput(seed, 12, 3, 12))
      const stops = ctx.cases.map((_, i) => i)
      const r = routeOf(stops, ctx)
      const before = r.travel
      orderRoute(ctx, r)
      expect(r.travel).toBeLessThanOrEqual(before + 1e-9)
      expect([...r.stops].sort((a, b) => a - b)).toEqual(stops)
      expect(r.travel).toBe(travelOf(ctx, r.stops))
    }
  })
})
