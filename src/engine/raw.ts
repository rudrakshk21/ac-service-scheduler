import type { Route } from './route'

/** The planner's working result: the Python Result as Maps. Keys are case indexes unless stated. */
export interface RawResult {
  date: Map<number, number>
  tech: Map<number, number>
  visit: Map<number, number>
  why: Map<number, string>
  prevKm: Map<number, number>
  travelMin: Map<number, number>
  eta: Map<number, string>
  flag: Map<number, string>
  days: number[]
  /** day number -> technician index -> route. Insertion order is technician order. */
  routes: Map<number, Map<number, Route>>
  unscheduled: Set<number>
  unschedReason: Map<number, string>
}

export function newRaw(): RawResult {
  return {
    date: new Map(),
    tech: new Map(),
    visit: new Map(),
    why: new Map(),
    prevKm: new Map(),
    travelMin: new Map(),
    eta: new Map(),
    flag: new Map(),
    days: [],
    routes: new Map(),
    unscheduled: new Set(),
    unschedReason: new Map(),
  }
}
