import { weekday } from '../engine/calendar'
import { t, type MessageKey } from '../i18n'

/** `YYYY-MM-DD` for a day number (days since 1970-01-01). */
export const isoOf = (day: number): string => new Date(day * 86_400_000).toISOString().slice(0, 10)

/** The name of the weekday of a day number, in the language in use. */
export const weekdayName = (day: number): string => t(`weekday.${weekday(day)}` as MessageKey)
