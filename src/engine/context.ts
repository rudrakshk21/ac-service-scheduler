import { buildGeo, type Geo } from './geo'
import type { CaseIn, PlanInput, Place, PriorityLevel, Settings, Technician, WorkType } from './types'

/** The two levels of step 1: a normal case and an escalated one (a huge bonus, so it is planned first). */
export const DEFAULT_LEVELS: PriorityLevel[] = [
  { name: 'Normal', weight: 0 },
  { name: 'Escalated', weight: 100000 },
]

/** What is resolved once per technician: where the day starts and ends (nodes of the travel table, 0 = base)
 *  and the working hours (own value, else the shared setting). */
export interface TechPlan {
  startNode: number
  endNode: number
  usableMin: number
  dayStartMin: number
  lunchStartMin: number
  breakMin: number
}

/** The input plus everything computed once per plan. */
export interface Ctx {
  s: Settings
  workTypes: WorkType[]
  technicians: Technician[]
  places: Place[]
  cases: CaseIn[]
  geo: Geo
  /** Node of each case in the travel table: its place index + 1 (node 0 is the base). */
  caseNode: number[]
  /** Per technician, in input order. */
  techPlan: TechPlan[]
  levels: PriorityLevel[]
  /** Priority bonus of each case (the weight of its level). */
  caseWeight: number[]
  dueWeight: number
  dueWindow: number
}

export function buildContext(input: PlanInput): Ctx {
  const s = input.settings
  const levels = s.priorityLevels ?? DEFAULT_LEVELS
  return {
    s,
    workTypes: input.workTypes,
    technicians: input.technicians,
    places: input.places,
    cases: input.cases,
    geo: buildGeo(input.settings, input.places),
    caseNode: input.cases.map((c) => c.place + 1),
    techPlan: input.technicians.map((t) => ({
      startNode: t.startPlace === undefined ? 0 : t.startPlace + 1,
      endNode: t.endPlace === undefined ? 0 : t.endPlace + 1,
      usableMin: t.usableMin ?? s.usableMin,
      dayStartMin: t.dayStartMin ?? s.dayStartMin,
      lunchStartMin: t.lunchStartMin ?? s.lunchStartMin,
      breakMin: t.breakMin ?? s.breakMin,
    })),
    levels,
    caseWeight: input.cases.map((c) => levels[c.priority ?? (c.escalated === true ? levels.length - 1 : 0)].weight),
    dueWeight: s.dueWeight ?? 8,
    dueWindow: s.urgencyWindowDays ?? 5,
  }
}
