import type { Cell } from './table'

/** Order of the three parts in a numeric date such as 13/10/2026. */
export type DateOrder = 'dmy' | 'mdy' | 'ymd'

/** Month names and abbreviations, lower-case. Data, so other languages can be added. */
export const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5, june: 6, jun: 6,
  july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9, october: 10, oct: 10,
  november: 11, nov: 11, december: 12, dec: 12,
}

const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
const daysIn = (y: number, m: number): number => (m === 2 ? (isLeap(y) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31)
const pad = (n: number, w: number): string => String(n).padStart(w, '0')

function iso(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > daysIn(y, m)) return null
  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`
}

/** Two-digit years: 00 to 69 mean 2000 to 2069, 70 to 99 mean 1970 to 1999. */
const fullYear = (text: string): number => {
  const y = Number(text)
  return text.length <= 2 ? (y < 70 ? 2000 + y : 1900 + y) : y
}

/** A spreadsheet serial number (days since 1899-12-30, the Excel 1900 system) as a calendar date. */
export function serialToIso(serial: number): string {
  const days = Math.floor(serial) - 25569 // serial 25569 is 1970-01-01
  return new Date(days * 86400000).toISOString().slice(0, 10)
}

const TIME = '(?:[T\\s].*)?$'
const ISO = new RegExp(`^(\\d{4})-(\\d{1,2})-(\\d{1,2})${TIME}`)
const YEAR_FIRST = new RegExp(`^(\\d{4})[/.](\\d{1,2})[/.](\\d{1,2})${TIME}`)
const NUMERIC = new RegExp(`^(\\d{1,2})[/.\\-](\\d{1,2})[/.\\-](\\d{4}|\\d{2})${TIME}`)
const DAY_MONTH_NAME = new RegExp(`^(\\d{1,2})[\\s\\-/.]+([A-Za-z]{3,9})\\.?[\\s\\-/.,]+(\\d{4}|\\d{2})${TIME}`)
const MONTH_NAME_DAY = new RegExp(`^([A-Za-z]{3,9})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4}|\\d{2})${TIME}`)

/**
 * A date cell as `YYYY-MM-DD`, the calendar date as written (no time-zone shifting), or null when it is not a date.
 * `order` settles numeric dates such as 04/05/2026; with no order, such a date is read only when one part is above 12.
 */
export function parseDate(value: Cell, order: DateOrder | null): string | null {
  if (value === null || typeof value === 'boolean') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : iso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate())
  }
  if (typeof value === 'number') return value >= 20000 && value <= 80000 ? serialToIso(value) : null
  const t = value.trim()
  if (t === '') return null
  let m = ISO.exec(t) ?? YEAR_FIRST.exec(t)
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]))
  m = NUMERIC.exec(t)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    const y = fullYear(m[3])
    if (order === 'dmy') return iso(y, b, a)
    if (order === 'mdy') return iso(y, a, b)
    if (order === 'ymd') return null
    if (a > 12) return iso(y, b, a)
    if (b > 12) return iso(y, a, b)
    return a === b ? iso(y, b, a) : null
  }
  m = DAY_MONTH_NAME.exec(t)
  if (m) {
    const month = MONTHS[m[2].toLowerCase()]
    return month === undefined ? null : iso(fullYear(m[3]), month, Number(m[1]))
  }
  m = MONTH_NAME_DAY.exec(t)
  if (m) {
    const month = MONTHS[m[1].toLowerCase()]
    return month === undefined ? null : iso(fullYear(m[3]), month, Number(m[2]))
  }
  return null
}

/**
 * Decides the order of numeric dates from a column's values. A first part above 12 means day-first, a second part
 * above 12 means month-first. When neither shows, or both do, the user confirms once (`ambiguous`).
 * `order: null` with `ambiguous: false` means the column holds no numeric dates at all.
 */
export function detectDateOrder(values: string[]): { order: DateOrder | null; ambiguous: boolean } {
  let dmy = false
  let mdy = false
  let ymd = false
  let unclear = false
  let seen = 0
  for (const v of values) {
    const t = v.trim()
    if (t === '') continue
    if (seen >= 200) break
    if (ISO.test(t) || YEAR_FIRST.test(t)) {
      ymd = true
      seen += 1
      continue
    }
    const m = NUMERIC.exec(t)
    if (!m) continue
    seen += 1
    const a = Number(m[1])
    const b = Number(m[2])
    if (a > 12 && b <= 12) dmy = true
    else if (b > 12 && a <= 12) mdy = true
    else if (a <= 12 && b <= 12) unclear = true
  }
  if (ymd && !dmy && !mdy && !unclear) return { order: 'ymd', ambiguous: false }
  if (dmy && !mdy && !ymd) return { order: 'dmy', ambiguous: false }
  if (mdy && !dmy && !ymd) return { order: 'mdy', ambiguous: false }
  if (!ymd && !dmy && !mdy && !unclear) return { order: null, ambiguous: false }
  return { order: null, ambiguous: true }
}
