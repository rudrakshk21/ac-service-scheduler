import type { Ctx } from './context'

/** One technician's stops for one day. `ver` changes whenever the stops change (used by the greedy cache). */
export class Route {
  stops: number[] = []
  travel = 0.0
  service = 0.0
  frac = 0.0
  pinned = false
  ver = 0
  /** Node the route starts at (0 = base). */
  readonly startNode: number
  /** Node the route ends at (0 = base). */
  readonly endNode: number

  constructor(startNode = 0, endNode = 0) {
    this.startNode = startNode
    this.endNode = endNode
  }
}

/** Travel minutes of a stop list: start place, each stop in order, end place. No stops, no travel. */
export function travelOf(ctx: Ctx, stops: number[], startNode = 0, endNode = 0): number {
  if (stops.length === 0) return 0.0
  const tm = ctx.geo.tm
  let t = 0.0
  let prev = startNode
  for (const c of stops) {
    const nd = ctx.caseNode[c]
    t += tm[prev][nd]
    prev = nd
  }
  return t + tm[prev][endNode]
}

/** Cheapest place to add case `c` to the route: the extra travel minutes and the position. */
export function bestInsert(ctx: Ctx, r: Route, c: number): { delta: number; pos: number } {
  const n = r.stops.length
  const cn = ctx.caseNode[c]
  const tm = ctx.geo.tm
  // An empty route costs the whole trip (start, stop, end), not only a detour.
  if (n === 0) return { delta: tm[r.startNode][cn] + tm[cn][r.endNode], pos: 0 }
  let delta = Infinity
  let pos = 0
  for (let p = 0; p <= n; p++) {
    const prev = p === 0 ? r.startNode : ctx.caseNode[r.stops[p - 1]]
    const nxt = p === n ? r.endNode : ctx.caseNode[r.stops[p]]
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
  r.travel = travelOf(ctx, r.stops, r.startNode, r.endNode)
  r.service = 0.0
  r.frac = 0.0
  for (const c of r.stops) {
    const wt = ctx.workTypes[ctx.cases[c].workType]
    r.service += wt.serviceMin
    r.frac += 1.0 / wt.dailyCeiling
  }
}
