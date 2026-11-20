import type { Ctx } from './context'
import { haversineKm } from './geo'
import { formatClock, pyInt, pyRound } from './pymath'
import type { RawResult } from './raw'
import { recalc } from './route'

/** Arrival times, visit numbers, kilometres from the previous stop and the plain-language reasons. */
export function finalise(ctx: Ctx, res: RawResult): void {
  const s = ctx.s
  const tm = ctx.geo.tm
  for (const day of res.days) {
    for (const [t, r] of res.routes.get(day) ?? []) {
      recalc(ctx, r)
      const tp = ctx.techPlan[t]
      let clock = tp.dayStartMin
      let brk = false
      let prev = r.startNode
      if (r.travel + r.service > tp.usableMin + 1e-6) {
        for (const c of r.stops) res.flag.set(c, 'OVER CAPACITY')
      }
      for (let i = 0; i < r.stops.length; i++) {
        const c = r.stops[i]
        const node = ctx.caseNode[c]
        const nxt = i + 1 < r.stops.length ? ctx.caseNode[r.stops[i + 1]] : r.endNode
        const tmin = tm[prev][node]
        clock += tmin
        if (!brk && clock >= tp.lunchStartMin) {
          clock += tp.breakMin
          brk = true
        }
        res.eta.set(c, formatClock(clock))
        res.travelMin.set(c, tmin)
        res.visit.set(c, i + 1)
        const due = ctx.cases[c].dueDay
        if (due !== undefined && day > due) {
          const lateDays = day - due
          const late = `LATE BY ${lateDays} DAY${lateDays === 1 ? '' : 'S'}`
          const had = res.flag.get(c)
          res.flag.set(c, had === undefined ? late : `${had}; ${late}`)
        }
        const wt = ctx.workTypes[ctx.cases[c].workType]
        clock += ctx.caseService[c]
        prev = node
        const pn = i === 0 ? r.startNode : ctx.caseNode[r.stops[i - 1]]
        const detour = tm[pn][node] + tm[node][nxt] - tm[pn][nxt]
        if (!res.why.has(c)) {
          const extra = detour < 1 ? 'no extra travel' : `adds ${pyInt(pyRound(detour))} min detour`
          const stops = `${r.stops.length} stop${r.stops.length > 1 ? 's' : ''}`
          let why = `Skill match (${ctx.technicians[t].name} approved for ${wt.name}); ${extra}; route of ${stops} in ${ctx.geo.zone[ctx.cases[c].place]}`
          const level = ctx.cases[c].priority
          if (level !== undefined) why += `; priority ${ctx.levels[level].name}`
          res.why.set(c, why)
        }
      }
    }
  }
  for (const day of res.days) {
    for (const r of res.routes.get(day)?.values() ?? []) {
      let prevPlace = r.startNode - 1
      for (const c of r.stops) {
        const a = ctx.cases[c].place
        let km: number
        if (prevPlace < 0) {
          km = ctx.geo.areaKm[a] * s.roadFactor
        } else if (prevPlace === a) {
          km = 0.0
        } else {
          const p = ctx.places[prevPlace]
          const q = ctx.places[a]
          km = haversineKm(p.lat, p.lon, q.lat, q.lon) * s.roadFactor
        }
        res.prevKm.set(c, km)
        prevPlace = a
      }
    }
  }
}
