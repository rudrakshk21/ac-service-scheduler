import { buildGeo, type Geo } from './geo'
import type { CaseIn, PlanInput, Place, Settings, Technician, WorkType } from './types'

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
}

export function buildContext(input: PlanInput): Ctx {
  const s = input.settings
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
  }
}
