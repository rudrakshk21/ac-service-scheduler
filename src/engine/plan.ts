import { isAvailable, makeCalendar } from './calendar'
import type { Ctx } from './context'
import { finalise } from './finalise'
import { orderRoute } from './order'
import { newRaw, type RawResult } from './raw'
import { bestInsert, fits, recalc, Route, travelOf } from './route'

function removeFirst(a: number[], x: number): void {
  const i = a.indexOf(x)
  if (i >= 0) a.splice(i, 1)
}

function canDo(ctx: Ctx, t: number, c: number): boolean {
  return ctx.technicians[t].skills.includes(ctx.workTypes[ctx.cases[c].workType].requiredSkill)
}

/** Working space for `greedy`, made once for a whole plan: one entry for every case and technician pair. */
interface GreedyWork {
  /** Where each technician stands in the eligible list of each case (-1: not in it). It settles equal scores. */
  rank: Int32Array
  /** The route version an offer was worked out for (-1: not yet). */
  stamp: Int32Array
  /** The score of adding the case to the route, or Infinity when it does not fit. */
  offered: Float64Array
  /** The position in the route that offer is for. */
  where: Int32Array
}

function makeGreedyWork(ctx: Ctx, eligible: Map<number, number[]>): GreedyWork {
  const nTech = ctx.technicians.length
  const n = ctx.cases.length * nTech
  const rank = new Int32Array(n).fill(-1)
  for (const [c, list] of eligible) {
    for (let i = 0; i < list.length; i++) rank[c * nTech + list[i]] = i
  }
  return { rank, stamp: new Int32Array(n), offered: new Float64Array(n), where: new Int32Array(n) }
}

/**
 * Greedy cheapest insertion: repeatedly take the best-scoring feasible (case, technician) pair. Among equal scores
 * the first case in pool order wins, and for that case the first technician in its eligible order.
 *
 * Adding a stop changes one route only, so what it would cost to add a case to every other route is unchanged. What
 * adding a case to a route costs is worked out once for each version of the route and kept. Each case also keeps its
 * best offer; after a stop is added, only the cases that favoured that route are looked at again in full, and every
 * other case just compares its old best with what the changed route now offers. The choice is the one a scan of every
 * case and technician would make, found without doing that scan for every stop.
 */
function greedy(
  ctx: Ctx,
  routes: Map<number, Route>,
  pool: number[],
  left: number[],
  eligible: Map<number, number[]>,
  day: number,
  work: GreedyWork,
): void {
  const nTech = ctx.technicians.length
  const nCase = ctx.cases.length
  const { rank, stamp, offered, where } = work
  stamp.fill(-1)
  const routeOf: (Route | undefined)[] = new Array<Route | undefined>(nTech)
  for (const [t, r] of routes) routeOf[t] = r
  const bonus = new Float64Array(nCase)
  const bestScore = new Float64Array(nCase)
  const bestTech = new Int32Array(nCase)
  const bestPos = new Int32Array(nCase)

  /** The score of adding case `c` to technician `t`'s route as it is now; Infinity when it does not fit. */
  const offer = (c: number, t: number): number => {
    const r = routeOf[t]
    if (r === undefined) return Infinity
    const k = c * nTech + t
    if (stamp[k] !== r.ver) {
      const { delta, pos } = bestInsert(ctx, r, c)
      stamp[k] = r.ver
      where[k] = pos
      offered[k] = fits(ctx, r, c, delta) ? delta + ctx.s.balanceWeight * (r.travel + r.service) - bonus[c] : Infinity
    }
    return offered[k]
  }

  /** The best offer for case `c` over all its technicians. */
  const rescan = (c: number): void => {
    let score = Infinity
    let tech = -1
    for (const t of eligible.get(c) ?? []) {
      const s = offer(c, t)
      if (s < score) {
        score = s
        tech = t
      }
    }
    bestScore[c] = score
    bestTech[c] = tech
    bestPos[c] = tech < 0 ? 0 : where[c * nTech + tech]
  }

  for (const c of pool) {
    const cs = ctx.cases[c]
    const age = Math.min(90.0, Math.max(0.0, day - cs.reportedDay))
    let b = age * ctx.s.ageWeight + ctx.caseWeight[c]
    if (cs.dueDay !== undefined) {
      b += ctx.dueWeight * Math.min(90.0, Math.max(0.0, ctx.dueWindow - (cs.dueDay - day)))
    }
    bonus[c] = b
    rescan(c)
  }

  for (;;) {
    let best = Infinity
    let bc = -1
    for (const c of pool) {
      if (bestScore[c] < best) {
        best = bestScore[c]
        bc = c
      }
    }
    if (bc < 0) break
    const bt = bestTech[bc]
    const rr = routeOf[bt]
    if (rr === undefined) break
    rr.stops.splice(bestPos[bc], 0, bc)
    recalc(ctx, rr)
    removeFirst(pool, bc)
    removeFirst(left, bc)
    // Only route `bt` changed.
    for (const c of pool) {
      if (bestTech[c] === bt) {
        rescan(c)
        continue
      }
      const rk = rank[c * nTech + bt]
      if (rk < 0) continue
      const s = offer(c, bt)
      const current = bestTech[c]
      if (s < bestScore[c] || (s === bestScore[c] && current >= 0 && rk < rank[c * nTech + current])) {
        bestScore[c] = s
        bestTech[c] = bt
        bestPos[c] = where[c * nTech + bt]
      }
    }
  }
}

/** Moves cases between routes while that saves travel (up to 20 rounds). */
function relocate(ctx: Ctx, routes: Map<number, Route>, eligible: Map<number, number[]>): void {
  for (let round = 0; round < 20; round++) {
    let bestGain = 0.5
    let bc = -1
    let frm = -1
    let to = -1
    let bp = 0
    for (const [k, r] of routes) {
      if (r.pinned) continue
      for (const c of r.stops) {
        const without = r.stops.filter((x) => x !== c)
        const saved = r.travel - travelOf(ctx, without, r.startNode, r.endNode)
        for (const t of eligible.get(c) ?? []) {
          const target = routes.get(t)
          if (t === k || target === undefined || target.pinned) continue
          const { delta, pos } = bestInsert(ctx, target, c)
          if (!fits(ctx, target, c, delta)) continue
          const gain = saved - delta
          if (gain > bestGain) {
            bestGain = gain
            bc = c
            frm = k
            to = t
            bp = pos
          }
        }
      }
    }
    if (bc < 0) return
    const from = routes.get(frm)
    const dest = routes.get(to)
    if (from === undefined || dest === undefined) return
    removeFirst(from.stops, bc)
    recalc(ctx, from)
    dest.stops.splice(bp, 0, bc)
    recalc(ctx, dest)
    orderRoute(ctx, from)
    orderRoute(ctx, dest)
  }
}

/** Plans day by day from the start day. Returns the raw result (before conversion to the public shape). */
export function runPlan(ctx: Ctx): RawResult {
  const res = newRaw()
  const { s, cases, technicians } = ctx
  const cal = makeCalendar(s)
  const left: number[] = cases.map((_, i) => i)
  const eligible = new Map<number, number[]>()
  for (let c = 0; c < cases.length; c++) {
    let l: number[] = []
    for (let t = 0; t < technicians.length; t++) {
      if (technicians[t].active && canDo(ctx, t, c)) l.push(t)
    }
    const req = cases[c].pinnedTech ?? -1
    if (req >= 0) l = l.filter((x) => x === req)
    eligible.set(c, l)
    if (l.length === 0) {
      removeFirst(left, c)
      res.unscheduled.add(c)
      res.unschedReason.set(
        c,
        req >= 0 ? 'Manual technician is not approved for this work type' : 'No active technician has this skill',
      )
    }
  }

  const work = makeGreedyWork(ctx, eligible)
  let day = s.startDay
  let worked = 0
  let guard = 0
  while (left.length > 0 && worked < s.horizonDays && guard < 2000) {
    guard += 1
    if (!cal.isWorkday(day)) {
      day += 1
      continue
    }
    worked += 1
    const routes = new Map<number, Route>()
    for (let t = 0; t < technicians.length; t++) {
      if (isAvailable(technicians[t], day)) {
        const tp = ctx.techPlan[t]
        routes.set(t, new Route(tp.startNode, tp.endNode, tp.usableMin))
      }
    }
    const pool = left.filter((c) => {
      const md = cases[c].earliestDay
      return !(md !== undefined && md > day)
    })
    for (const c of [...pool]) {
      const cs = cases[c]
      const req = cs.pinnedTech ?? -1
      const frz = cs.frozenTech ?? -1
      let pt = -1
      if (req >= 0 && cs.earliestDay !== undefined && cs.earliestDay === day) pt = req
      else if (frz >= 0 && day === s.startDay) pt = frz
      if (pt < 0 || !canDo(ctx, pt, c)) continue
      const r = routes.get(pt)
      if (r === undefined) continue
      const { pos } = bestInsert(ctx, r, c)
      r.stops.splice(pos, 0, c)
      recalc(ctx, r)
      r.pinned = true
      removeFirst(pool, c)
      removeFirst(left, c)
      res.why.set(c, req >= 0 && cs.earliestDay !== undefined ? 'Manual assignment' : 'Kept from earlier plan (frozen)')
      res.tech.set(c, pt)
      res.date.set(c, day)
    }
    for (let pass = 0; pass < 3; pass++) {
      greedy(ctx, routes, pool, left, eligible, day, work)
      for (const r of routes.values()) orderRoute(ctx, r)
      relocate(ctx, routes, eligible)
    }
    greedy(ctx, routes, pool, left, eligible, day, work)
    for (const r of routes.values()) orderRoute(ctx, r)
    res.days.push(day)
    res.routes.set(day, routes)
    for (const [t, r] of routes) {
      for (const c of r.stops) {
        res.date.set(c, day)
        res.tech.set(c, t)
      }
    }
    day += 1
  }
  for (const c of left) {
    res.unscheduled.add(c)
    if (!res.unschedReason.has(c)) {
      let reason = `Beyond planning horizon (${s.horizonDays} working days) or does not fit in a day`
      if (cases[c].dueDay !== undefined) reason += '; due date missed'
      res.unschedReason.set(c, reason)
    }
  }
  finalise(ctx, res)
  return res
}
