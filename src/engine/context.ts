import { buildGeo, type Geo } from './geo'
import type { CaseIn, PlanInput, Place, Settings, Technician, WorkType } from './types'

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
}

export function buildContext(input: PlanInput): Ctx {
  return {
    s: input.settings,
    workTypes: input.workTypes,
    technicians: input.technicians,
    places: input.places,
    cases: input.cases,
    geo: buildGeo(input.settings, input.places),
    caseNode: input.cases.map((c) => c.place + 1),
  }
}
