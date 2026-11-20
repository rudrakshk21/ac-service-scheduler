import { isAvailable, makeCalendar } from '../calendar'
import type { PlanInput, PlanResult } from '../types'

/** Checks the safety rules on a result. Assumes the input has no manual pins. Returns the problems found. */
export function checkInvariants(input: PlanInput, result: PlanResult): string[] {
  const problems: string[] = []
  const byId = new Map(input.cases.map((c) => [c.id, c]))
  const cal = makeCalendar(input.settings)

  // INV-1: every case is in exactly one list
  const seen = new Map<string, number>()
  for (const s of result.scheduled) seen.set(s.id, (seen.get(s.id) ?? 0) + 1)
  for (const u of result.unscheduled) seen.set(u.id, (seen.get(u.id) ?? 0) + 1)
  for (const c of input.cases) {
    if (seen.get(c.id) !== 1) problems.push(`INV-1: case ${c.id} appears ${seen.get(c.id) ?? 0} times`)
  }

  for (const s of result.scheduled) {
    const c = byId.get(s.id)
    const tech = input.technicians[s.tech]
    if (c === undefined || tech === undefined) {
      problems.push(`INV-1: scheduled case ${s.id} or technician ${s.tech} does not exist`)
      continue
    }
    // INV-2: the technician holds the skill the work type requires
    if (!tech.skills.includes(input.workTypes[c.workType].requiredSkill)) {
      problems.push(`INV-2: ${tech.name} lacks the skill for case ${s.id}`)
    }
    // INV-4: a working day, and the technician is available
    if (!cal.isWorkday(s.day)) problems.push(`INV-4: case ${s.id} is on a rest day or holiday (day ${s.day})`)
    if (!isAvailable(tech, s.day)) problems.push(`INV-4: ${tech.name} is not available on day ${s.day}`)
    // INV-6: a reason
    if (s.why === '') problems.push(`INV-6: case ${s.id} has no reason`)
  }
  for (const u of result.unscheduled) {
    if (u.reason === '') problems.push(`INV-6: unscheduled case ${u.id} has no reason`)
  }

  // INV-3: within usable minutes and the daily ceilings
  for (const r of result.routes) {
    if (r.travelMin + r.serviceMin > input.settings.usableMin + 1e-6) {
      problems.push(`INV-3: technician ${r.tech} on day ${r.day} uses ${r.travelMin + r.serviceMin} minutes`)
    }
    const counts = new Map<number, number>()
    for (const id of r.stops) {
      const wt = byId.get(id)?.workType ?? 0
      counts.set(wt, (counts.get(wt) ?? 0) + 1)
    }
    for (const [wt, n] of counts) {
      if (n > input.workTypes[wt].dailyCeiling + 1e-9) {
        problems.push(`INV-3: technician ${r.tech} on day ${r.day} has ${n} cases of work type ${wt}`)
      }
    }
  }
  return problems
}
