import type { PlanInput, PlanResult } from '../engine'
import { summarise } from '../demo/viewModel'
import { t, type MessageKey } from '../i18n'
import type { Workspace } from '../workspace/workspace'
import { isoOf, weekdayName } from './dates'

export type Cell = string | number

/** The fixed names of the tables, the same in every language: used for file names. */
export type TableId = 'schedule' | 'dayRoutes' | 'notPlanned' | 'summary' | 'changeLog'

/** One sheet of an export: a name, a header row and rows of text and numbers. */
export interface Table {
  id: TableId
  /** The name in the language in use: the sheet name, and what a button says. */
  name: string
  headers: string[]
  rows: Cell[][]
}

const one = (n: number): number => Math.round(n * 10) / 10
const heads = (...keys: MessageKey[]): string[] => keys.map((k) => t(k))

/**
 * The five tables of an export, in a fixed order: the schedule, the routes of each day, what is not planned, a summary
 * and the change log of the imports. The same rows feed CSV and Excel. `caseIds` are the cases that went into the plan.
 * Names and headers are in the language in use; case numbers, places and the planner's reasons are the data.
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
    if (c.state === 'hold') return [[c.caseId, t('held.hold')]]
    if (c.state === 'review') return [[c.caseId, t('held.review')]]
    if (c.state === 'active' && !planned.has(c.caseId)) return [[c.caseId, t('held.unknown')]]
    return []
  })
  const notPlanned: Cell[][] = [...result.unscheduled.map((u): Cell[] => [u.id, u.reason]), ...heldBack]

  const s = summarise(input, result)
  const summary: Cell[][] = [
    [t('summary.centre'), w.site.name],
    [t('summary.madeOn'), madeOn],
    [t('summary.firstDay'), p.planStart],
    [t('summary.planned'), s.scheduled],
    [t('summary.notPlanned'), s.unscheduled],
    [t('summary.days'), s.days],
    [t('summary.techsWorking'), s.techniciansUsed],
    [t('summary.techsTotal'), s.techniciansTotal],
    [t('summary.drivingHours'), s.travelHours],
    [t('summary.onSiteHours'), s.onSiteHours],
  ]

  const changes: Cell[][] = w.changes.map((c) => [c.caseId, c.field, c.previous, c.next, c.reason])

  return [
    {
      id: 'schedule', name: t('table.schedule'), rows: schedule,
      headers: heads('col.case', 'col.workType', 'col.place', 'col.date', 'col.weekday', 'col.technician', 'col.visit', 'col.arrival', 'col.drivingMinutes', 'col.kilometres', 'col.reason', 'col.flag'),
    },
    {
      id: 'dayRoutes', name: t('table.dayRoutes'), rows: routes,
      headers: heads('col.date', 'col.technician', 'col.visits', 'col.stopsInOrder', 'col.drivingMinutes', 'col.onSiteMinutes'),
    },
    { id: 'notPlanned', name: t('table.notPlanned'), headers: heads('col.case', 'col.reason'), rows: notPlanned },
    { id: 'summary', name: t('table.summary'), headers: heads('col.item', 'col.value'), rows: summary },
    { id: 'changeLog', name: t('table.changeLog'), headers: heads('col.case', 'col.field', 'col.before', 'col.after', 'col.reason'), rows: changes },
  ]
}
