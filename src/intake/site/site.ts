import type { PriorityLevel, Settings, WorkType } from '../../engine/types'
import { normaliseName } from '../map/model'
import { checker, parseJson } from '../validate'

/** Everything the planner's settings hold except what is passed per run: the start day, the holidays and the levels. */
export type SiteSettings = Omit<Settings, 'holidays' | 'startDay' | 'priorityLevels'>

export interface SitePlace {
  name: string
  latitude: number
  longitude: number
  postalCode?: string
  zone?: string
}

/** One center's set-up: what its work types, skills and priority levels are, where its places are, and its rule values.
 *  A JSON file that holds no case data. */
export interface SiteProfile {
  siteVersion: 1
  name: string
  settings: SiteSettings
  /** `requiredSkill` is an index into `skills`. */
  workTypes: WorkType[]
  skills: string[]
  /** Lowest first. */
  priorityLevels: PriorityLevel[]
  places: SitePlace[]
  /** Spelling found in files (normalised) to the place name to use instead. */
  aliases: Record<string, string>
  /** Keep the technician a file assigns as a manual pin (true) or ignore it (false). */
  keepAssignedTechnician: boolean
  /** Extra column names the site confirmed, per field: the dictionary grows. */
  columnNames: Record<string, string[]>
}

export function serializeSite(s: SiteProfile): string {
  return JSON.stringify(s, null, 2) + '\n'
}

/** Reads a site profile file. Throws an `IntakeError` (`bad_site`) that names the field when it is invalid. */
export function parseSite(text: string): SiteProfile {
  const c = checker('bad_site', 'Site profile')
  const o = c.record(parseJson(text, 'bad_site', 'Site profile'), 'file')
  if (o.siteVersion !== 1) {
    c.fail('siteVersion', typeof o.siteVersion === 'number' && o.siteVersion > 1
      ? 'is newer than this app understands (it reads version 1)'
      : 'must be 1')
  }
  const s = c.record(o.settings, 'settings')
  const settings: SiteSettings = {
    baseLat: c.num(s.baseLat, 'settings.baseLat', -90, 90),
    baseLon: c.num(s.baseLon, 'settings.baseLon', -180, 180),
    speedKmh: c.num(s.speedKmh, 'settings.speedKmh'),
    roadFactor: c.num(s.roadFactor, 'settings.roadFactor'),
    sameAreaHopMin: c.num(s.sameAreaHopMin, 'settings.sameAreaHopMin', 0),
    usableMin: c.num(s.usableMin, 'settings.usableMin', 0),
    dayStartMin: c.num(s.dayStartMin, 'settings.dayStartMin', 0),
    lunchStartMin: c.num(s.lunchStartMin, 'settings.lunchStartMin', 0),
    breakMin: c.num(s.breakMin, 'settings.breakMin', 0),
    ageWeight: c.num(s.ageWeight, 'settings.ageWeight', 0),
    balanceWeight: c.num(s.balanceWeight, 'settings.balanceWeight', 0),
    maxKm: c.num(s.maxKm, 'settings.maxKm', 0),
    horizonDays: c.int(s.horizonDays, 'settings.horizonDays', 0),
    restWeekdays: c.list(s.restWeekdays, 'settings.restWeekdays').map((d, i) => c.int(d, `settings.restWeekdays[${i}]`, 0, 6)),
  }
  if (settings.speedKmh <= 0) c.fail('settings.speedKmh', 'must be greater than 0')
  if (settings.roadFactor <= 0) c.fail('settings.roadFactor', 'must be greater than 0')
  if (s.dueWeight !== undefined) settings.dueWeight = c.num(s.dueWeight, 'settings.dueWeight', 0)
  if (s.urgencyWindowDays !== undefined) settings.urgencyWindowDays = c.num(s.urgencyWindowDays, 'settings.urgencyWindowDays', 0)

  const skills = c.list(o.skills, 'skills').map((k, i) => c.text(k, `skills[${i}]`))
  if (skills.length === 0) c.fail('skills', 'must list at least one skill')
  const workTypes = c.list(o.workTypes, 'workTypes').map((w, i): WorkType => {
    const r = c.record(w, `workTypes[${i}]`)
    const ceiling = c.num(r.dailyCeiling, `workTypes[${i}].dailyCeiling`)
    if (ceiling <= 0) c.fail(`workTypes[${i}].dailyCeiling`, 'must be greater than 0')
    return {
      name: c.text(r.name, `workTypes[${i}].name`),
      serviceMin: c.num(r.serviceMin, `workTypes[${i}].serviceMin`, 0),
      dailyCeiling: ceiling,
      requiredSkill: c.int(r.requiredSkill, `workTypes[${i}].requiredSkill`, 0, skills.length - 1),
    }
  })
  if (workTypes.length === 0) c.fail('workTypes', 'must list at least one work type')
  const priorityLevels = c.list(o.priorityLevels, 'priorityLevels').map((l, i): PriorityLevel => {
    const r = c.record(l, `priorityLevels[${i}]`)
    return { name: c.text(r.name, `priorityLevels[${i}].name`), weight: c.num(r.weight, `priorityLevels[${i}].weight`, 0) }
  })
  if (priorityLevels.length === 0) c.fail('priorityLevels', 'must list at least one level')

  const names = new Set<string>()
  const places = c.list(o.places, 'places').map((p, i): SitePlace => {
    const r = c.record(p, `places[${i}]`)
    const name = c.text(r.name, `places[${i}].name`)
    if (names.has(normaliseName(name))) c.fail(`places[${i}].name`, `"${name}" is used twice`)
    names.add(normaliseName(name))
    const place: SitePlace = {
      name,
      latitude: c.num(r.latitude, `places[${i}].latitude`, -90, 90),
      longitude: c.num(r.longitude, `places[${i}].longitude`, -180, 180),
    }
    const postal = c.optText(r.postalCode, `places[${i}].postalCode`)
    if (postal !== undefined) place.postalCode = postal
    const zone = c.optText(r.zone, `places[${i}].zone`)
    if (zone !== undefined) place.zone = zone
    return place
  })
  const aliases: Record<string, string> = {}
  for (const [k, v] of Object.entries(c.record(o.aliases, 'aliases'))) {
    const target = c.text(v, `aliases["${k}"]`)
    if (!names.has(normaliseName(target))) c.fail(`aliases["${k}"]`, `points to "${target}", which is not in the place table`)
    aliases[k] = target
  }
  const columnNames: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(c.record(o.columnNames, 'columnNames'))) {
    columnNames[k] = c.list(v, `columnNames.${k}`).map((x, i) => c.text(x, `columnNames.${k}[${i}]`))
  }
  return {
    siteVersion: 1,
    name: c.text(o.name, 'name'),
    settings, workTypes, skills, priorityLevels, places, aliases,
    keepAssignedTechnician: c.bool(o.keepAssignedTechnician, 'keepAssignedTechnician'),
    columnNames,
  }
}

/** The site with `places` added. A place whose name is already there (any case or accent) is skipped. Does not change its input. */
export function extendPlaces(site: SiteProfile, places: SitePlace[]): SiteProfile {
  const have = new Set(site.places.map((p) => normaliseName(p.name)))
  const added: SitePlace[] = []
  for (const p of places) {
    const key = normaliseName(p.name)
    if (have.has(key)) continue
    have.add(key)
    added.push({ ...p })
  }
  return { ...site, places: [...site.places, ...added] }
}
