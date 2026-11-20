import { pyMod } from './pymath'
import type { Settings, Technician } from './types'

/** Day number (days since 1970-01-01) of an ISO date such as "2026-10-13". */
export function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

/** Monday = 0 ... Sunday = 6. Day 0, 1970-01-01, was a Thursday. */
export function weekday(day: number): number {
  return pyMod(day + 3, 7)
}

export function makeCalendar(s: Settings): { isWorkday(day: number): boolean } {
  const rest = new Set(s.restWeekdays)
  const holidays = new Set(s.holidays)
  return { isWorkday: (day) => !rest.has(weekday(day)) && !holidays.has(day) }
}

/** A technician is available when active and not on leave that day. */
export function isAvailable(tech: Technician, day: number): boolean {
  if (!tech.active) return false
  if (tech.leaveFrom !== undefined && day >= tech.leaveFrom && (tech.leaveTo === undefined || day <= tech.leaveTo)) {
    return false
  }
  return true
}
