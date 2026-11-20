import type { PlanInput } from '../../engine/types'
import { openName, CASE_FIELDS, PLACE_FIELDS, TECHNICIAN_FIELDS } from '../map/model'
import { serializeCsv } from '../read/csv'
import type { SiteProfile } from '../site/site'
import { starterSite } from '../site/starter'

/** Day number to `YYYY-MM-DD`. Test code only. */
export const isoOf = (day: number): string => new Date(day * 86_400_000).toISOString().slice(0, 10)

const p2 = (n: number): string => String(n).padStart(2, '0')
const clock = (min: number): string => `${p2(Math.floor(min / 60))}:${p2(min % 60)}`

/** The site profile that matches a plan input: its work types, skills, settings and priority levels (not its places). */
export function siteFromInput(input: PlanInput): SiteProfile {
  const site = starterSite()
  const { holidays: _h, startDay: _s, priorityLevels, ...settings } = input.settings
  site.settings = settings
  site.workTypes = input.workTypes.map((w) => ({ ...w }))
  const skillCount = Math.max(...input.workTypes.map((w) => w.requiredSkill), ...input.technicians.flatMap((t) => t.skills), 0) + 1
  site.skills = Array.from({ length: skillCount }, (_, i) => `Skill ${i}`)
  if (priorityLevels !== undefined) site.priorityLevels = priorityLevels.map((l) => ({ ...l }))
  site.keepAssignedTechnician = true
  return site
}

/** Visit minutes of a case in a plan input, written to the file only when the case has its own or a product-based time. */
function ownMinutes(input: PlanInput, c: PlanInput['cases'][number]): number | undefined {
  if (c.serviceMin !== undefined) return c.serviceMin
  if (c.productType === undefined) return undefined
  const p = input.productTypes?.[c.productType]
  return input.workTypes[c.workType].serviceMin * (p?.factor ?? 1) + (p?.addMin ?? 0)
}

const row = (fields: readonly string[], values: Record<string, string>): string[] => fields.map((f) => values[openName(f)] ?? '')

/** A plan input written as three open-format CSV files (cases, technicians, places). */
export function filesFromInput(input: PlanInput): { cases: string; technicians: string; places: string } {
  const cases = input.cases.map((c) => {
    const v: Record<string, string> = {
      case_id: c.id,
      work_type: input.workTypes[c.workType].name,
      area: input.places[c.place].name,
      reported_at: isoOf(c.reportedDay),
    }
    if (c.escalated === true) v.priority = 'Escalated'
    if (c.dueDay !== undefined) v.due_at = isoOf(c.dueDay)
    if (c.earliestDay !== undefined) v.earliest_date = isoOf(c.earliestDay)
    if (c.pinnedTech !== undefined) v.technician = input.technicians[c.pinnedTech].name
    const minutes = ownMinutes(input, c)
    if (minutes !== undefined) v.duration_min = String(minutes)
    return row(CASE_FIELDS, v)
  })
  const techs = input.technicians.map((t) => {
    const v: Record<string, string> = {
      name: t.name,
      skills: t.skills.map((s) => `Skill ${s}`).join(';'),
      active: t.active ? 'yes' : 'no',
    }
    if (t.leaveFrom !== undefined) v.leave_from = isoOf(t.leaveFrom)
    if (t.leaveTo !== undefined) v.leave_to = isoOf(t.leaveTo)
    if (t.startPlace !== undefined) v.start_area = input.places[t.startPlace].name
    if (t.endPlace !== undefined) v.end_area = input.places[t.endPlace].name
    if (t.dayStartMin !== undefined) v.shift_start = clock(t.dayStartMin)
    if (t.usableMin !== undefined) {
      const brk = t.breakMin ?? input.settings.breakMin
      v.shift_hours = String((t.usableMin + brk) / 60)
      v.break_min = String(brk)
    } else if (t.breakMin !== undefined) v.break_min = String(t.breakMin)
    return row(TECHNICIAN_FIELDS, v)
  })
  const places = input.places.map((p) => row(PLACE_FIELDS, { area: p.name, latitude: String(p.lat), longitude: String(p.lon) }))
  const head = (f: readonly string[]): string[] => f.map(openName)
  return {
    cases: serializeCsv([head(CASE_FIELDS), ...cases], ','),
    technicians: serializeCsv([head(TECHNICIAN_FIELDS), ...techs], ','),
    places: serializeCsv([head(PLACE_FIELDS), ...places], ','),
  }
}
