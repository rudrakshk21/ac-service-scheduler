import type { PlanInput, PlanResult } from '../engine'
import { summarise } from '../demo/viewModel'
import type { Workspace } from '../workspace/workspace'
import { isoOf, weekdayName } from './dates'

export type Cell = string | number

/** One sheet of an export: a name, a header row and rows of text and numbers. */
export interface Table {
  name: string
  headers: string[]
  rows: Cell[][]
}

const one = (n: number): number => Math.round(n * 10) / 10

/**
 * The five tables of an export, in a fixed order: the schedule, the routes of each day, what is not planned, a summary
 * and the change log of the imports. The same rows feed CSV and Excel. `caseIds` are the cases that went into the plan.
 */
export function buildTables(
  w: Workspace,
  p: { input: PlanInput; caseIds: string[]; planStart: string },
  result: PlanResult,
  madeOn: string,
): Table[] {
  const { input } = p
  const caseById = new Map(input.cases.map((c) => [c.id, c]))

  const schedule: Cell[][] = [...result.scheduled]
    .sort((a, b) => a.day - b.day || input.technicians[a.tech].name.localeCompare(input.technicians[b.tech].name) || a.visit - b.visit)
    .map((s) => {
      const c = caseById.get(s.id)
      return [
        s.id,
        c === undefined ? '' : input.workTypes[c.workType].name,
        c === undefined ? '' : input.places[c.place].name,
        isoOf(s.day),
        weekdayName(s.day),
        input.technicians[s.tech].name,
        s.visit,
        s.eta,
        one(s.travelMin),
        one(s.prevKm),
        s.why,
        s.flag,
      ]
    })

  const routes: Cell[][] = result.routes
    .filter((r) => r.stops.length > 0)
    .map((r) => [isoOf(r.day), input.technicians[r.tech].name, r.stops.length, r.stops.join(' > '), one(r.travelMin), one(r.serviceMin)])

  const planned = new Set(p.caseIds)
  const heldBack: Cell[][] = w.cases.flatMap((c): Cell[][] => {
    if (c.state === 'hold') return [[c.caseId, 'On hold']]
    if (c.state === 'review') return [[c.caseId, 'Needs review']]
    if (c.state === 'active' && !planned.has(c.caseId)) return [[c.caseId, 'The place or work type is not known']]
    return []
  })
  const notPlanned: Cell[][] = [...result.unscheduled.map((u): Cell[] => [u.id, u.reason]), ...heldBack]

  const s = summarise(input, result)
  const summary: Cell[][] = [
    ['Centre', w.site.name],
    ['Made on', madeOn],
    ['First day', p.planStart],
    ['Cases planned', s.scheduled],
    ['Cases not planned', s.unscheduled],
    ['Working days', s.days],
    ['Technicians working', s.techniciansUsed],
    ['Technicians in total', s.techniciansTotal],
    ['Driving hours', s.travelHours],
    ['On-site hours', s.onSiteHours],
  ]

  const changes: Cell[][] = w.changes.map((c) => [c.caseId, c.field, c.previous, c.next, c.reason])

  return [
    { name: 'Schedule', headers: ['Case', 'Work type', 'Place', 'Date', 'Weekday', 'Technician', 'Visit', 'Arrival', 'Driving minutes', 'Kilometres', 'Reason', 'Flag'], rows: schedule },
    { name: 'Day routes', headers: ['Date', 'Technician', 'Visits', 'Stops in order', 'Driving minutes', 'On-site minutes'], rows: routes },
    { name: 'Not planned', headers: ['Case', 'Reason'], rows: notPlanned },
    { name: 'Summary', headers: ['Item', 'Value'], rows: summary },
    { name: 'Change log', headers: ['Case', 'Field', 'Before', 'After', 'Reason'], rows: changes },
  ]
}
