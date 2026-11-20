import type { Ctx } from './context'

/** One technician's stops for one day. `ver` changes whenever the stops change (used by the greedy cache). */
export class Route {
  stops: number[] = []
  travel = 0.0
  service = 0.0
  frac = 0.0
  pinned = false
  ver = 0
}

/** Travel minutes of a stop list: base, each stop in order, base. */
export function travelOf(ctx: Ctx, stops: number[]): number {
  if (stops.length === 0) return 0.0
  const tm = ctx.geo.tm
  let t = 0.0
  let prev = 0
  for (const c of stops) {
    const nd = ctx.caseNode[c]
    t += tm[prev][nd]
    prev = nd
  }
  return t + tm[prev][0]
}

/** Cheapest place to add case `c` to the route: the extra travel minutes and the position. */
export function bestInsert(ctx: Ctx, r: Route, c: number): { delta: number; pos: number } {
  let delta = Infinity
  let pos = 0
  const n = r.stops.length
  const cn = ctx.caseNode[c]
  const tm = ctx.geo.tm
  for (let p = 0; p <= n; p++) {
    const prev = p === 0 ? 0 : ctx.caseNode[r.stops[p - 1]]
    const nxt = p === n ? 0 : ctx.caseNode[r.stops[p]]
    const d = tm[prev][cn] + tm[cn][nxt] - tm[prev][nxt]
    if (d < delta) {
      delta = d
      pos = p
    }
  }
  return { delta, pos }
}

/** Whether adding case `c` (extra travel `delta`) keeps the route within usable minutes and the daily ceilings. */
export function fits(ctx: Ctx, r: Route, c: number, delta: number): boolean {
  const wt = ctx.workTypes[ctx.cases[c].workType]
  if (r.travel + delta + r.service + wt.serviceMin > ctx.s.usableMin + 1e-6) return false
  if (r.frac + 1.0 / wt.dailyCeiling > 1.0 + 1e-6) return false
  return true
}

/** Recomputes travel, on-site minutes and the share of the daily ceilings from the stop list. */
export function recalc(ctx: Ctx, r: Route): void {
  r.ver += 1
  r.travel = travelOf(ctx, r.stops)
  r.service = 0.0
  r.frac = 0.0
  for (const c of r.stops) {
    const wt = ctx.workTypes[ctx.cases[c].workType]
    r.service += wt.serviceMin
    r.frac += 1.0 / wt.dailyCeiling
  }
}
