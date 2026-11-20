import { parseDate } from '../read/dates'
import { parseNumber } from '../read/numbers'
import type { Cell, SourceTable } from '../read/table'
import type { SitePlace, SiteProfile } from '../site/site'
import { normaliseName } from './model'
import type { MappingProfile } from './profile'
import { resolveLocation } from './places'
import { finishQuality, markBadDate, markFilled, markUnknown, newTally, type QualityReport } from './quality'
import { mapPriority, mapSkills, mapStatus, mapWorkType } from './values'

export type { QualityReport } from './quality'

/** What an import decides about a case. Scheduled and Not scheduled are results of planning, not of importing. */
export type CaseState = 'active' | 'hold' | 'review' | 'ignored'

export interface ImportedCase {
  caseId: string
  workType?: string
  latitude?: number
  longitude?: number
  postalCode?: string
  area?: string
  address?: string
  status?: string
  reportedAt?: string
  priority?: string
  dueAt?: string
  productType?: string
  durationMin?: number
  earliestDate?: string
  technician?: string
  customerName?: string
  notes?: string
  otherRef?: string
  /** Resolved place: its name in the site's table, or a place created from coordinates. Absent when unresolved. */
  place?: string
  /** The site work type the source value mapped to. Absent when unmapped (the case is in review). */
  workTypeName?: string
  priorityLevel?: string
  state: CaseState
}

export interface ImportedTechnician {
  name: string
  skills: string[]
  active: boolean
  leaveFrom?: string
  leaveTo?: string
  startPlace?: string
  endPlace?: string
  /** Minutes after midnight. */
  shiftStart?: number
  shiftHours?: number
  breakMin?: number
}

export type IssueCode = 'missing_id' | 'no_location' | 'unknown_work_type' | 'bad_date' | 'duplicate_id'

export interface IntakeException {
  caseId: string
  issue: IssueCode
  detail: string
  suggestedAction: string
}

export interface Imported {
  kind: MappingProfile['kind']
  cases: ImportedCase[]
  technicians: ImportedTechnician[]
  /** Places made from coordinates or read from a places file; the caller adds them to the site. */
  places: SitePlace[]
  exceptions: IntakeException[]
  quality: QualityReport
}

/** A row such as "Total" at the bottom of a sheet (English, German, Italian and French words). */
const TOTAL_ROW = /^(total|grand total|sum|subtotal|gesamt|summe|totale|somme)\b/i

function cellText(c: Cell | undefined): string | undefined {
  if (c === null || c === undefined) return undefined
  if (c instanceof Date) return c.toISOString().slice(0, 10)
  if (typeof c === 'number') return String(c)
  if (typeof c === 'boolean') return c ? 'true' : 'false'
  const t = c.trim()
  return t === '' ? undefined : t
}

/** `yes`, `no`, `true`, `1` and the like. Anything else counts as active. */
function parseActive(c: Cell | undefined): boolean {
  if (typeof c === 'boolean') return c
  if (typeof c === 'number') return c !== 0
  const t = cellText(c)?.toLowerCase()
  return !(t !== undefined && ['no', 'n', 'false', '0', 'inactive', 'off'].includes(t))
}

/** A time of day as minutes after midnight: `08:30`, `8.30`, `8:30 PM`, an Excel day fraction, or a time cell. */
export function parseClock(c: Cell | undefined): number | undefined {
  if (c === null || c === undefined) return undefined
  if (c instanceof Date) return c.getUTCHours() * 60 + c.getUTCMinutes()
  if (typeof c === 'number') return c > 0 && c < 1 ? Math.round(c * 1440) : undefined
  if (typeof c !== 'string') return undefined
  const t = c.trim().toLowerCase()
  const m = /^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(am|pm)?$/.exec(t)
  if (m !== null) {
    let h = Number(m[1])
    const min = Number(m[2])
    if (m[3] === 'pm' && h < 12) h += 12
    if (m[3] === 'am' && h === 12) h = 0
    return h <= 23 && min <= 59 ? h * 60 + min : undefined
  }
  const asDay = Number(t.replace(',', '.'))
  return Number.isFinite(asDay) && asDay > 0 && asDay < 1 ? Math.round(asDay * 1440) : undefined
}

/**
 * Applies a confirmed mapping profile to a table. Only mapped columns are read: every other column is dropped here and
 * never kept. Problems (missing identifier, duplicates, unknown categories, unresolved places, unreadable dates) become
 * exceptions and entries in the quality report; the case is still imported where it can be.
 */
export function applyProfile(table: SourceTable, profile: MappingProfile, site: SiteProfile, importDate: string): Imported {
  const columns = (field: string): number[] =>
    (profile.columns[field] ?? []).map((h) => table.headers.indexOf(h)).filter((i) => i >= 0)
  const cols = new Map<string, number[]>()
  for (const f of Object.keys(profile.columns)) cols.set(f, columns(f))
  const first = (row: Cell[], field: string): Cell | undefined => {
    for (const i of cols.get(field) ?? []) if (row[i] !== null && row[i] !== undefined) return row[i]
    return undefined
  }
  const all = (row: Cell[], field: string): string[] =>
    (cols.get(field) ?? []).map((i) => cellText(row[i])).filter((t): t is string => t !== undefined)
  const text = (row: Cell[], field: string): string | undefined => cellText(first(row, field))
  const decimal = profile.formats.decimal ?? '.'
  const number = (row: Cell[], field: string): number | undefined => parseNumber(first(row, field) ?? null, decimal) ?? undefined
  const dateOrder = profile.formats.dateOrder ?? null

  const tally = newTally()
  const exceptions: IntakeException[] = []
  const created = new Map<string, SitePlace>()
  const base = { rowsRead: table.rows.length, blank: table.detected.blankRows, total: 0, ragged: table.detected.raggedRows, duplicates: 0, unresolved: 0 }
  const label = (i: number): string => `(row ${i + 1})`

  const date = (row: Cell[], field: string, id: string): string | undefined => {
    const raw = first(row, field)
    if (raw === undefined) return undefined
    const d = parseDate(raw, dateOrder)
    if (d === null) {
      const shown = cellText(raw) ?? ''
      markBadDate(tally, field, shown)
      exceptions.push({ caseId: id, issue: 'bad_date', detail: `${field} "${shown}" is not a date`, suggestedAction: 'Fix the date in the file or confirm the day and month order.' })
      return undefined
    }
    return d
  }

  const out: Imported = {
    kind: profile.kind, cases: [], technicians: [], places: [], exceptions,
    quality: undefined as unknown as QualityReport,
  }
  const seen = new Set<string>()
  const placeNames = new Set<string>()

  table.rows.forEach((row, r) => {
    if (profile.kind === 'cases') {
      let id = text(row, 'caseId')
      if (id === undefined) {
        exceptions.push({ caseId: label(r), issue: 'missing_id', detail: 'The row has no case identifier.', suggestedAction: 'Add an identifier in the file; the row was not imported.' })
        return
      }
      if (TOTAL_ROW.test(id)) {
        base.total += 1
        return
      }
      id = id.replace(/^(\d+)\.0+$/, '$1')
      if (seen.has(id)) {
        base.duplicates += 1
        exceptions.push({ caseId: id, issue: 'duplicate_id', detail: `The identifier ${id} appears more than once; the first row was kept.`, suggestedAction: 'Remove the repeated rows or check the identifiers.' })
        return
      }
      seen.add(id)
      tally.kept += 1
      for (const f of cols.keys()) if (first(row, f) !== undefined) markFilled(tally, f)

      const c: ImportedCase = { caseId: id, state: 'active' }
      const wtSource = text(row, 'workType')
      const wt = mapWorkType(profile, site, wtSource)
      if (wt.name !== null) c.workTypeName = wt.name
      else if (wt.unknown !== null) {
        markUnknown(tally, 'workType', wt.unknown)
        exceptions.push({ caseId: id, issue: 'unknown_work_type', detail: `The category "${wt.unknown}" is not mapped to a work type.`, suggestedAction: 'Map the category to a work type; the case waits in review until then.' })
      }
      if (wtSource !== undefined) c.workType = wtSource

      const lat = number(row, 'latitude')
      const lon = number(row, 'longitude')
      const postal = text(row, 'postalCode')
      const address = text(row, 'address')
      const areas = all(row, 'area')
      if (lat !== undefined) c.latitude = lat
      if (lon !== undefined) c.longitude = lon
      if (postal !== undefined) c.postalCode = postal
      if (address !== undefined) c.address = address
      if (areas.length > 0) c.area = areas[0]
      let place: string | null = null
      for (const a of [...areas, undefined]) {
        place = resolveLocation({ latitude: lat, longitude: lon, postalCode: postal, area: a, address }, site, created).place
        if (place !== null) break
      }
      if (place !== null) c.place = place
      else {
        base.unresolved += 1
        const given = [areas[0], postal, address].filter((x) => x !== undefined).join(' / ') || 'nothing'
        exceptions.push({ caseId: id, issue: 'no_location', detail: `The location (${given}) is not in the place table.`, suggestedAction: 'Add the place or an alias for it in the site set-up.' })
      }

      const st = mapStatus(profile, text(row, 'status'))
      if (st.unknown !== null) markUnknown(tally, 'status', st.unknown)
      const stText = text(row, 'status')
      if (stText !== undefined) c.status = stText
      c.state = st.action === 'hold' ? 'hold' : st.action === 'ignore' ? 'ignored' : c.workTypeName === undefined ? 'review' : 'active'

      const pr = text(row, 'priority')
      const pm = mapPriority(profile, site, pr)
      if (pr !== undefined) c.priority = pr
      if (pm.level !== null) c.priorityLevel = pm.level
      if (pm.unknown !== null) markUnknown(tally, 'priority', pm.unknown)

      const reported = date(row, 'reportedAt', id)
      if (reported !== undefined) c.reportedAt = reported
      else if (first(row, 'reportedAt') === undefined) c.reportedAt = importDate
      const due = date(row, 'dueAt', id)
      if (due !== undefined) c.dueAt = due
      const earliest = date(row, 'earliestDate', id)
      if (earliest !== undefined) c.earliestDate = earliest
      for (const f of ['productType', 'technician', 'customerName', 'notes', 'otherRef'] as const) {
        const v = text(row, f)
        if (v !== undefined) c[f] = v
      }
      const dur = number(row, 'durationMin')
      if (dur !== undefined) c.durationMin = dur
      out.cases.push(c)
      return
    }

    if (profile.kind === 'technicians') {
      const name = text(row, 'name')
      if (name === undefined) {
        exceptions.push({ caseId: label(r), issue: 'missing_id', detail: 'The row has no technician name.', suggestedAction: 'Add a name in the file; the row was not imported.' })
        return
      }
      if (seen.has(normaliseName(name))) {
        base.duplicates += 1
        exceptions.push({ caseId: name, issue: 'duplicate_id', detail: `The name ${name} appears more than once; the first row was kept.`, suggestedAction: 'Make the names unique.' })
        return
      }
      seen.add(normaliseName(name))
      tally.kept += 1
      for (const f of cols.keys()) if (first(row, f) !== undefined) markFilled(tally, f)
      const sk = mapSkills(profile, site, all(row, 'skills'))
      for (const u of sk.unknown) markUnknown(tally, 'skill', u)
      const t: ImportedTechnician = { name, skills: sk.skills, active: parseActive(first(row, 'active')) }
      const from = date(row, 'leaveFrom', name)
      if (from !== undefined) t.leaveFrom = from
      const to = date(row, 'leaveTo', name)
      if (to !== undefined) t.leaveTo = to
      for (const side of ['start', 'end'] as const) {
        const area = text(row, `${side}Area`)
        const latitude = number(row, `${side}Latitude`)
        const longitude = number(row, `${side}Longitude`)
        if (area === undefined && latitude === undefined && longitude === undefined) continue
        const p = resolveLocation({ area, latitude, longitude }, site, created).place
        if (p !== null) t[`${side}Place`] = p
        else exceptions.push({ caseId: name, issue: 'no_location', detail: `The ${side} place (${area ?? 'coordinates'}) is not in the place table.`, suggestedAction: 'Add the place in the site set-up; the technician starts and ends at the base until then.' })
      }
      const clock = parseClock(first(row, 'shiftStart'))
      if (clock !== undefined) t.shiftStart = clock
      const hours = number(row, 'shiftHours')
      if (hours !== undefined) t.shiftHours = hours
      const brk = number(row, 'breakMin')
      if (brk !== undefined) t.breakMin = brk
      out.technicians.push(t)
      return
    }

    // places
    const name = text(row, 'area')
    if (name === undefined) {
      exceptions.push({ caseId: label(r), issue: 'missing_id', detail: 'The row has no place name.', suggestedAction: 'Add a name in the file; the row was not imported.' })
      return
    }
    if (placeNames.has(normaliseName(name))) {
      base.duplicates += 1
      exceptions.push({ caseId: name, issue: 'duplicate_id', detail: `The place ${name} appears more than once; the first row was kept.`, suggestedAction: 'Make the place names unique.' })
      return
    }
    const lat = number(row, 'latitude')
    const lon = number(row, 'longitude')
    if (lat === undefined || lon === undefined || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      exceptions.push({ caseId: name, issue: 'no_location', detail: `The place ${name} has no usable coordinates.`, suggestedAction: 'Add latitude and longitude in decimal degrees.' })
      return
    }
    placeNames.add(normaliseName(name))
    tally.kept += 1
    for (const f of cols.keys()) if (first(row, f) !== undefined) markFilled(tally, f)
    const place: SitePlace = { name, latitude: lat, longitude: lon }
    const postal = text(row, 'postalCode')
    if (postal !== undefined) place.postalCode = postal
    const zone = text(row, 'zone')
    if (zone !== undefined) place.zone = zone
    out.places.push(place)
  })

  out.places.push(...created.values())
  out.quality = finishQuality(tally, base, [...cols.keys()])
  return out
}
