import { checkInput } from './check'
import { buildContext, type Ctx } from './context'
import { runPlan } from './plan'
import type { RawResult } from './raw'
import type { PlanInput, PlanResult, RouteSummary, ScheduledCase } from './types'

export type * from './types'

function toPlanResult(ctx: Ctx, raw: RawResult): PlanResult {
  const scheduled: ScheduledCase[] = []
  ctx.cases.forEach((c, i) => {
    const day = raw.date.get(i)
    const tech = raw.tech.get(i)
    if (day === undefined || tech === undefined) return
    scheduled.push({
      id: c.id,
      day,
      tech,
      visit: raw.visit.get(i) ?? 0,
      eta: raw.eta.get(i) ?? '',
      travelMin: raw.travelMin.get(i) ?? 0,
      prevKm: raw.prevKm.get(i) ?? 0,
      why: raw.why.get(i) ?? '',
      flag: raw.flag.get(i) ?? '',
    })
  })
  const unscheduled = [...raw.unscheduled]
    .sort((a, b) => a - b)
    .map((i) => ({ id: ctx.cases[i].id, reason: raw.unschedReason.get(i) ?? '' }))
  const routes: RouteSummary[] = []
  for (const day of raw.days) {
    for (const [tech, r] of raw.routes.get(day) ?? []) {
      routes.push({
        day,
        tech,
        stops: r.stops.map((c) => ctx.cases[c].id),
        travelMin: r.travel,
        serviceMin: r.service,
        load: r.frac,
      })
    }
  }
  return { scheduled, unscheduled, days: [...raw.days], routes }
}

/** Plans the cases of one input. The same input always gives the same result. Throws on invalid input. */
export function plan(input: PlanInput): PlanResult {
  checkInput(input)
  const ctx = buildContext(input)
  return toPlanResult(ctx, runPlan(ctx))
}
