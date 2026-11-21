import { weekday } from '../engine/calendar'

/** `YYYY-MM-DD` for a day number (days since 1970-01-01). */
export const isoOf = (day: number): string => new Date(day * 86_400_000).toISOString().slice(0, 10)

const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** The English name of the weekday of a day number. */
export const weekdayName = (day: number): string => NAMES[weekday(day)]
