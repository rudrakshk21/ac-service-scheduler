import { dayNumber } from '../../engine/calendar'
import type { CaseIn, PlanInput, Technician } from '../../engine/types'
import type { ImportedTechnician } from '../map/apply'
import { normaliseName } from '../map/model'
import type { SiteProfile } from '../site/site'
import type { StoredCase } from './merge'

export interface PlanOptions {
  /** First day of the plan, `YYYY-MM-DD`. */
  planStart: string
  /** Days nobody works, `YYYY-MM-DD`. */
  holidays?: string[]
  /** Used for a case that has no reported date. */
  importDate: string
}

const NUMERIC = /^\d+$/

/** Identifiers that are all digits sort by number, before text identifiers, which sort by text. */
function compareIds(a: string, b: string): number {
  const na = NUMERIC.test(a)
  const nb = NUMERIC.test(b)
  if (na && nb) return Number(a) - Number(b) || (a < b ? -1 : a > b ? 1 : 0)
  if (na !== nb) return na ? -1 : 1
  return a < b ? -1 : a > b ? 1 : 0
}

const indexer = (names: readonly string[]): ((name: string | undefined) => number) => {
  const map = new Map<string, number>()
  names.forEach((n, i) => {
    if (!map.has(normaliseName(n))) map.set(normaliseName(n), i)
  })
  return (name) => (name === undefined ? -1 : (map.get(normaliseName(name)) ?? -1))
}

/**
 * Builds the planning engine's input. Only `active` cases with a work type and a place go in; held, review, ignored,
 * done and closed cases stay out. Cases are sorted by identifier because the engine never sorts. The places are those
 * of the site table, so add places made from coordinates first (`extendPlaces`). `caseIds` lists the cases in input order.
 */
export function toPlanInput(
  site: SiteProfile, cases: StoredCase[], technicians: ImportedTechnician[], options: PlanOptions,
): { input: PlanInput; caseIds: string[] } {
  const workTypeAt = indexer(site.workTypes.map((w) => w.name))
  const skillAt = indexer(site.skills)
  const placeAt = indexer(site.places.map((p) => p.name))
  const levelAt = indexer(site.priorityLevels.map((l) => l.name))
  const techAt = indexer(technicians.map((t) => t.name))

  const techs: Technician[] = technicians.map((t) => {
    const out: Technician = {
      name: t.name,
      skills: [...new Set(t.skills.map(skillAt).filter((i) => i >= 0))],
      active: t.active,
    }
    if (t.leaveFrom !== undefined) out.leaveFrom = dayNumber(t.leaveFrom)
    if (t.leaveTo !== undefined) out.leaveTo = dayNumber(t.leaveTo)
    const start = placeAt(t.startPlace)
    if (start >= 0) out.startPlace = start
    const end = placeAt(t.endPlace)
    if (end >= 0) out.endPlace = end
    if (t.shiftStart !== undefined) out.dayStartMin = t.shiftStart
    if (t.shiftHours !== undefined) out.usableMin = t.shiftHours * 60 - (t.breakMin ?? site.settings.breakMin)
    if (t.breakMin !== undefined) out.breakMin = t.breakMin
    return out
  })

  const usable = cases
    .filter((c) => c.state === 'active' && workTypeAt(c.workTypeName) >= 0 && placeAt(c.place) >= 0)
    .sort((a, b) => compareIds(a.caseId, b.caseId))
  const caseIn = usable.map((c): CaseIn => {
    const out: CaseIn = {
      id: c.caseId,
      workType: workTypeAt(c.workTypeName),
      place: placeAt(c.place),
      reportedDay: dayNumber(c.reportedAt ?? options.importDate),
    }
    const level = levelAt(c.priorityLevel)
    if (level >= 0) out.priority = level
    if (c.dueAt !== undefined) out.dueDay = dayNumber(c.dueAt)
    const earliest = c.overrides.date ?? c.earliestDate
    if (earliest !== undefined) out.earliestDay = dayNumber(earliest)
    if (c.durationMin !== undefined) out.serviceMin = c.durationMin
    const assigned = techAt(c.overrides.technician ?? (site.keepAssignedTechnician ? c.technician : undefined))
    if (assigned >= 0) out.pinnedTech = assigned
    return out
  })

  const input: PlanInput = {
    settings: {
      ...site.settings,
      startDay: dayNumber(options.planStart),
      holidays: (options.holidays ?? []).map(dayNumber),
      priorityLevels: site.priorityLevels.map((l) => ({ ...l })),
    },
    workTypes: site.workTypes.map((w) => ({ ...w })),
    technicians: techs,
    places: site.places.map((p) => ({ name: p.name, lat: p.latitude, lon: p.longitude })),
    cases: caseIn,
  }
  return { input, caseIds: usable.map((c) => c.caseId) }
}
