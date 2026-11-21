import type { PlanInput, PlanResult } from '../engine'
import { visitMinutes } from '../engine/context'

/** Everything the demo page shows is computed here, from the engine's input and result, as plain data. */

export interface Summary {
  scheduled: number
  unscheduled: number
  days: number
  techniciansUsed: number
  techniciansTotal: number
  travelHours: number
  onSiteHours: number
}

const hours = (minutes: number): number => Math.round(minutes / 6) / 10 // one decimal

export function summarise(input: PlanInput, result: PlanResult): Summary {
  const used = new Set(result.scheduled.map((s) => s.tech))
  const total = (key: 'travelMin' | 'serviceMin'): number => result.routes.reduce((t, r) => t + r[key], 0)
  return {
    scheduled: result.scheduled.length,
    unscheduled: result.unscheduled.length,
    days: result.days.length,
    techniciansUsed: used.size,
    techniciansTotal: input.technicians.length,
    travelHours: hours(total('travelMin')),
    onSiteHours: hours(total('serviceMin')),
  }
}

export interface Block {
  kind: 'travel' | 'work' | 'break'
  startMin: number
  endMin: number
  /** Index into the work types, for work blocks. */
  workType?: number
}

export interface StopRow {
  visit: number
  id: string
  eta: string
  place: string
  workType: number
  workTypeName: string
  serviceMin: number
  /** Minutes of driving from the previous stop (or from the base). */
  travelMin: number
  why: string
  flag: string
}

export interface Lane {
  tech: number
  name: string
  active: boolean
  stops: StopRow[]
  blocks: Block[]
  travelMin: number
  serviceMin: number
  /** Minute of the day at which the technician is back at the base (0 when there is no route). */
  endMin: number
}

const clockToMinutes = (clock: string): number => {
  const [h, m] = clock.split(':').map(Number)
  return h * 60 + m
}

// A gap between arriving and starting work longer than this is the lunch break (arrival times are rounded to a minute).
const BREAK_GAP_MIN = 5

/** One lane per technician for one day: the ordered stops and the blocks of time that make up the day. */
export function lanesForDay(input: PlanInput, result: PlanResult, day: number): Lane[] {
  const routes = new Map(result.routes.filter((r) => r.day === day).map((r) => [r.tech, r]))
  const scheduled = new Map(result.scheduled.map((s) => [s.id, s]))
  const cases = new Map(input.cases.map((c) => [c.id, c]))

  return input.technicians.map((tech, index): Lane => {
    const route = routes.get(index)
    const lane: Lane = {
      tech: index, name: tech.name, active: tech.active, stops: [], blocks: [], travelMin: 0, serviceMin: 0, endMin: 0,
    }
    if (route === undefined) return lane

    let cursor = tech.dayStartMin ?? input.settings.dayStartMin
    let stopTravel = 0
    for (const id of route.stops) {
      const s = scheduled.get(id)
      const c = cases.get(id)
      if (s === undefined || c === undefined) continue
      const workType = input.workTypes[c.workType]
      const minutes = visitMinutes(input, c)
      const arrive = cursor + s.travelMin
      const start = clockToMinutes(s.eta)
      lane.blocks.push({ kind: 'travel', startMin: cursor, endMin: arrive })
      if (start - arrive > BREAK_GAP_MIN) lane.blocks.push({ kind: 'break', startMin: arrive, endMin: start })
      lane.blocks.push({ kind: 'work', startMin: start, endMin: start + minutes, workType: c.workType })
      lane.stops.push({
        visit: s.visit,
        id,
        eta: s.eta,
        place: input.places[c.place].name,
        workType: c.workType,
        workTypeName: workType.name,
        serviceMin: minutes,
        travelMin: s.travelMin,
        why: s.why,
        flag: s.flag,
      })
      stopTravel += s.travelMin
      cursor = start + minutes
    }
    const back = route.travelMin - stopTravel
    if (lane.stops.length > 0 && back > 0) lane.blocks.push({ kind: 'travel', startMin: cursor, endMin: cursor + back })
    lane.travelMin = route.travelMin
    lane.serviceMin = route.serviceMin
    lane.endMin = lane.stops.length > 0 ? cursor + Math.max(back, 0) : 0
    return lane
  })
}

export interface Axis {
  startMin: number
  endMin: number
  /** Minute of each whole hour from start to end. */
  ticks: number[]
}

/** The time axis of the board: whole hours, from the day start to the hour after the planned or actual end. */
export function dayAxis(input: PlanInput, lanes: Lane[]): Axis {
  const s = input.settings
  const starts = input.technicians.map((t) => t.dayStartMin ?? s.dayStartMin)
  const ends = input.technicians.map((t) => (t.dayStartMin ?? s.dayStartMin) + (t.usableMin ?? s.usableMin) + (t.breakMin ?? s.breakMin))
  const startMin = Math.floor(Math.min(s.dayStartMin, ...starts) / 60) * 60
  const planned = Math.max(s.dayStartMin + s.usableMin + s.breakMin, ...ends)
  const last = Math.max(planned, ...lanes.map((l) => l.endMin))
  const endMin = Math.ceil(last / 60) * 60
  const ticks: number[] = []
  for (let t = startMin; t <= endMin; t += 60) ticks.push(t)
  return { startMin, endMin, ticks }
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

/** "Tue" and "13 Oct" for a day number (days since 1970-01-01). */
export function dayLabel(day: number): { weekday: string; date: string } {
  const parts = dayFormat.formatToParts(new Date(day * 86_400_000))
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? ''
  return { weekday: get('weekday'), date: `${get('day')} ${get('month')}` }
}

export interface DayChoice {
  day: number
  weekday: string
  date: string
  visits: number
}

export function daysWithVisits(result: PlanResult): DayChoice[] {
  return result.days.map((day) => ({
    day,
    ...dayLabel(day),
    visits: result.scheduled.filter((s) => s.day === day).length,
  }))
}

export interface Change {
  moved: number
  /** Technicians who lost or gained at least one case. */
  techs: Set<number>
}

/** What a re-plan changed: cases that changed technician or day, or that entered or left the plan. */
export function movedCases(prev: PlanResult, next: PlanResult): Change {
  const before = new Map(prev.scheduled.map((s) => [s.id, s]))
  const after = new Map(next.scheduled.map((s) => [s.id, s]))
  const techs = new Set<number>()
  let moved = 0
  for (const [id, a] of after) {
    const b = before.get(id)
    if (b === undefined) {
      moved++
      techs.add(a.tech)
    } else if (b.day !== a.day || b.tech !== a.tech) {
      moved++
      techs.add(a.tech)
      techs.add(b.tech)
    }
  }
  for (const [id, b] of before) {
    if (!after.has(id)) {
      moved++
      techs.add(b.tech)
    }
  }
  return { moved, techs }
}
