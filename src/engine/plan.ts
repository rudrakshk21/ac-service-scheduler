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

/** Greedy cheapest insertion: repeatedly take the best-scoring feasible (case, technician) pair. */
function greedy(
  ctx: Ctx,
  routes: Map<number, Route>,
  pool: number[],
  left: number[],
  eligible: Map<number, number[]>,
  day: number,
): void {
  const nTech = ctx.technicians.length
  const cache = new Map<number, { ver: number; d: number; p: number }>()
  for (;;) {
    let bestScore = Infinity
    let bc = -1
    let bt = -1
    let bp = 0
    for (const c of pool) {
      const cs = ctx.cases[c]
      const age = Math.min(90.0, Math.max(0.0, day - cs.reportedDay))
      let bonus = age * ctx.s.ageWeight + ctx.caseWeight[c]
      if (cs.dueDay !== undefined) {
        bonus += ctx.dueWeight * Math.min(90.0, Math.max(0.0, ctx.dueWindow - (cs.dueDay - day)))
      }
      for (const t of eligible.get(c) ?? []) {
        const r = routes.get(t)
        if (r === undefined) continue
        const key = c * nTech + t
        let ent = cache.get(key)
        if (ent === undefined || ent.ver !== r.ver) {
          const { delta, pos } = bestInsert(ctx, r, c)
          ent = { ver: r.ver, d: delta, p: pos }
          cache.set(key, ent)
        }
        if (!fits(ctx, r, c, ent.d)) continue
        const score = ent.d + ctx.s.balanceWeight * (r.travel + r.service) - bonus
        if (score < bestScore) {
          bestScore = score
          bc = c
          bt = t
          bp = ent.p
        }
      }
    }
    if (bc < 0) break
    const rr = routes.get(bt)
    if (rr === undefined) break
    rr.stops.splice(bp, 0, bc)
    recalc(ctx, rr)
    removeFirst(pool, bc)
    removeFirst(left, bc)
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
      greedy(ctx, routes, pool, left, eligible, day)
      for (const r of routes.values()) orderRoute(ctx, r)
      relocate(ctx, routes, eligible)
    }
    greedy(ctx, routes, pool, left, eligible, day)
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
