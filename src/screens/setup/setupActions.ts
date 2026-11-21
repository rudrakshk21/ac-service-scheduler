import { t, tn, type MessageKey } from '../../i18n'
import type { ImportedTechnician } from '../../intake/map/apply'
import { normaliseName } from '../../intake/map/model'
import type { MappingProfile } from '../../intake/map/profile'
import type { SitePlace, SiteProfile, SiteSettings } from '../../intake/site/site'
import type { Workspace } from '../../workspace/workspace'

/** The result of an edit: the new workspace, or one plain sentence about why nothing changed. */
export type Outcome = { ok: true; workspace: Workspace } | { ok: false; error: string }

const ok = (workspace: Workspace): Outcome => ({ ok: true, workspace })
const fail = (error: string): Outcome => ({ ok: false, error })
const same = (a: string, b: string): boolean => normaliseName(a) === normaliseName(b)

const withSite = (w: Workspace, change: (s: SiteProfile) => SiteProfile): Workspace => ({ ...w, site: change(w.site) })
const mapProfiles = (w: Workspace, change: (p: MappingProfile) => MappingProfile): MappingProfile[] => w.profiles.map(change)

/** Renames a target inside a value map and drops nothing. */
function renameTargets(map: Record<string, string>, from: string, to: string): Record<string, string> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v === from ? to : v]))
}
function dropTargets(map: Record<string, string>, target: string): Record<string, string> {
  return Object.fromEntries(Object.entries(map).filter(([, v]) => v !== target))
}

// ---- the centre and its rules

export function setSiteName(w: Workspace, name: string): Outcome {
  const n = name.trim()
  return n === '' ? fail(t('setup.err.giveTheCentreAName')) : ok(withSite(w, (s) => ({ ...s, name: n })))
}

export function setBase(w: Workspace, lat: number, lon: number): Outcome {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return fail(t('setup.err.latitudeMustBeBetween90And90'))
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return fail(t('setup.err.longitudeMustBeBetween180And180'))
  return ok(withSite(w, (s) => ({ ...s, settings: { ...s.settings, baseLat: lat, baseLon: lon } })))
}

const RULES: Record<keyof SiteSettings, { label: MessageKey; min: number; above?: boolean; whole?: boolean }> = {
  baseLat: { label: 'setup.rule.baseLat', min: -90 }, baseLon: { label: 'setup.rule.baseLon', min: -180 },
  speedKmh: { label: 'setup.rule.speedKmh', min: 0, above: true }, roadFactor: { label: 'setup.rule.roadFactor', min: 0, above: true },
  sameAreaHopMin: { label: 'setup.rule.sameAreaHopMin', min: 0 }, usableMin: { label: 'setup.rule.usableMin', min: 0 },
  dayStartMin: { label: 'setup.rule.dayStartMin', min: 0 }, lunchStartMin: { label: 'setup.rule.lunchStartMin', min: 0 },
  breakMin: { label: 'setup.rule.breakMin', min: 0 }, ageWeight: { label: 'setup.rule.ageWeight', min: 0 },
  balanceWeight: { label: 'setup.rule.balanceWeight', min: 0 }, maxKm: { label: 'setup.rule.maxKm', min: 0 },
  horizonDays: { label: 'setup.rule.horizonDays', min: 0, whole: true }, restWeekdays: { label: 'setup.rule.restWeekdays', min: 0 },
  dueWeight: { label: 'setup.rule.dueWeight', min: 0 }, urgencyWindowDays: { label: 'setup.rule.urgencyWindowDays', min: 0 },
}

/** Changes rule values of the centre. Every value is checked; nothing changes unless all are valid. */
export function setSettings(w: Workspace, patch: Partial<SiteSettings>): Outcome {
  for (const [key, value] of Object.entries(patch) as [keyof SiteSettings, unknown][]) {
    const rule = RULES[key]
    if (value === undefined) continue
    if (key === 'restWeekdays') {
      if (!Array.isArray(value) || value.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return fail(t('setup.err.restDaysMustBeDaysOfThe'))
      continue
    }
    const label = t(rule.label)
    if (typeof value !== 'number' || !Number.isFinite(value)) return fail(t('setup.err.mustBeNumber', { label }))
    if (rule.above && value <= 0) return fail(t('setup.err.mustBeAboveZero', { label }))
    if (!rule.above && key !== 'baseLat' && key !== 'baseLon' && value < rule.min) return fail(t('setup.err.mustBeAtLeast', { label, min: rule.min }))
    if (rule.whole && !Number.isInteger(value)) return fail(t('setup.err.mustBeWhole', { label }))
    if (key === 'baseLat' && (value < -90 || value > 90)) return fail(t('setup.err.latitudeMustBeBetween90And90'))
    if (key === 'baseLon' && (value < -180 || value > 180)) return fail(t('setup.err.longitudeMustBeBetween180And180'))
  }
  return ok(withSite(w, (s) => ({ ...s, settings: { ...s.settings, ...patch } })))
}

// ---- work types

const skillIndex = (s: SiteProfile, name: string): number => s.skills.findIndex((k) => same(k, name))
const workTypeAt = (s: SiteProfile, name: string): number => s.workTypes.findIndex((x) => x.name === name)

export function addWorkType(w: Workspace, wt: { name: string; serviceMin: number; dailyCeiling: number; skill: string }): Outcome {
  const name = wt.name.trim()
  if (name === '') return fail(t('setup.err.nameNeeded'))
  if (w.site.workTypes.some((x) => same(x.name, name))) return fail(t('setup.err.nameUsed'))
  const skill = skillIndex(w.site, wt.skill)
  if (skill < 0) return fail(t('setup.err.chooseASkillThatExists'))
  if (!Number.isFinite(wt.serviceMin) || wt.serviceMin < 0) return fail(t('setup.err.visitMinutesMustBe0OrMore'))
  if (!Number.isFinite(wt.dailyCeiling) || wt.dailyCeiling <= 0) return fail(t('setup.err.theDailyLimitMustBeMoreThan'))
  return ok(withSite(w, (s) => ({ ...s, workTypes: [...s.workTypes, { name, serviceMin: wt.serviceMin, dailyCeiling: wt.dailyCeiling, requiredSkill: skill }] })))
}

export function updateWorkType(w: Workspace, name: string, patch: { serviceMin?: number; dailyCeiling?: number; skill?: string }): Outcome {
  const at = workTypeAt(w.site, name)
  if (at < 0) return fail(t('setup.err.thatWorkTypeDoesNotExist'))
  const next = { ...w.site.workTypes[at] }
  if (patch.serviceMin !== undefined) {
    if (!Number.isFinite(patch.serviceMin) || patch.serviceMin < 0) return fail(t('setup.err.visitMinutesMustBe0OrMore'))
    next.serviceMin = patch.serviceMin
  }
  if (patch.dailyCeiling !== undefined) {
    if (!Number.isFinite(patch.dailyCeiling) || patch.dailyCeiling <= 0) return fail(t('setup.err.theDailyLimitMustBeMoreThan'))
    next.dailyCeiling = patch.dailyCeiling
  }
  if (patch.skill !== undefined) {
    const k = skillIndex(w.site, patch.skill)
    if (k < 0) return fail(t('setup.err.chooseASkillThatExists'))
    next.requiredSkill = k
  }
  return ok(withSite(w, (s) => ({ ...s, workTypes: s.workTypes.map((x, i) => (i === at ? next : x)) })))
}

export function renameWorkType(w: Workspace, name: string, to: string): Outcome {
  const at = workTypeAt(w.site, name)
  const next = to.trim()
  if (at < 0) return fail(t('setup.err.thatWorkTypeDoesNotExist'))
  if (next === '') return fail(t('setup.err.nameNeeded'))
  if (w.site.workTypes.some((x, i) => i !== at && same(x.name, next))) return fail(t('setup.err.nameUsed'))
  return ok({
    ...withSite(w, (s) => ({ ...s, workTypes: s.workTypes.map((x, i) => (i === at ? { ...x, name: next } : x)) })),
    cases: w.cases.map((c) => (c.workTypeName === name ? { ...c, workTypeName: next } : c)),
    profiles: mapProfiles(w, (p) => ({
      ...p, valueMaps: { ...p.valueMaps, workType: renameTargets(p.valueMaps.workType, name, next) },
      ...(p.singleWorkType === name ? { singleWorkType: next } : {}),
    })),
  })
}

export function removeWorkType(w: Workspace, name: string): Outcome {
  const at = workTypeAt(w.site, name)
  if (at < 0) return fail(t('setup.err.thatWorkTypeDoesNotExist'))
  if (w.site.workTypes.length === 1) return fail(t('setup.err.aSiteNeedsAtLeastOneWork'))
  const used = w.cases.filter((c) => c.workTypeName === name).length
  if (used > 0) return fail(tn('setup.err.casesUseType', used))
  return ok({
    ...withSite(w, (s) => ({ ...s, workTypes: s.workTypes.filter((_, i) => i !== at) })),
    profiles: mapProfiles(w, (p) => {
      const { singleWorkType, ...rest } = p
      return { ...rest, valueMaps: { ...p.valueMaps, workType: dropTargets(p.valueMaps.workType, name) }, ...(singleWorkType === name || singleWorkType === undefined ? {} : { singleWorkType }) }
    }),
  })
}

// ---- skills

export function addSkill(w: Workspace, name: string): Outcome {
  const n = name.trim()
  if (n === '') return fail(t('setup.err.nameNeeded'))
  if (w.site.skills.some((k) => same(k, n))) return fail(t('setup.err.nameUsed'))
  return ok(withSite(w, (s) => ({ ...s, skills: [...s.skills, n] })))
}

export function renameSkill(w: Workspace, name: string, to: string): Outcome {
  const at = w.site.skills.indexOf(name)
  const next = to.trim()
  if (at < 0) return fail(t('setup.err.thatSkillDoesNotExist'))
  if (next === '') return fail(t('setup.err.nameNeeded'))
  if (w.site.skills.some((k, i) => i !== at && same(k, next))) return fail(t('setup.err.nameUsed'))
  return ok({
    ...withSite(w, (s) => ({ ...s, skills: s.skills.map((k, i) => (i === at ? next : k)) })),
    technicians: w.technicians.map((t) => ({ ...t, skills: t.skills.map((k) => (k === name ? next : k)) })),
    profiles: mapProfiles(w, (p) => ({ ...p, valueMaps: { ...p.valueMaps, skill: renameTargets(p.valueMaps.skill, name, next) } })),
  })
}

export function removeSkill(w: Workspace, name: string): Outcome {
  const at = w.site.skills.indexOf(name)
  if (at < 0) return fail(t('setup.err.thatSkillDoesNotExist'))
  if (w.site.skills.length === 1) return fail(t('setup.err.aSiteNeedsAtLeastOneSkill'))
  if (w.site.workTypes.some((x) => x.requiredSkill === at)) return fail(t('setup.err.aWorkTypeNeedsThisSkill'))
  const holders = w.technicians.filter((t) => t.skills.includes(name)).length
  if (holders > 0) return fail(tn('setup.err.techsHaveSkill', holders))
  return ok({
    ...withSite(w, (s) => ({
      ...s,
      skills: s.skills.filter((_, i) => i !== at),
      workTypes: s.workTypes.map((x) => (x.requiredSkill > at ? { ...x, requiredSkill: x.requiredSkill - 1 } : x)),
    })),
    profiles: mapProfiles(w, (p) => ({ ...p, valueMaps: { ...p.valueMaps, skill: dropTargets(p.valueMaps.skill, name) } })),
  })
}

// ---- priority levels

const levelAt = (s: SiteProfile, name: string): number => s.priorityLevels.findIndex((l) => l.name === name)

export function addLevel(w: Workspace, name: string, weight: number): Outcome {
  const n = name.trim()
  if (n === '') return fail(t('setup.err.nameNeeded'))
  if (w.site.priorityLevels.some((l) => same(l.name, n))) return fail(t('setup.err.nameUsed'))
  if (!Number.isFinite(weight) || weight < 0) return fail(t('setup.err.theWeightMustBe0OrMore'))
  return ok(withSite(w, (s) => ({ ...s, priorityLevels: [...s.priorityLevels, { name: n, weight }] })))
}

export function updateLevel(w: Workspace, name: string, patch: { weight?: number }): Outcome {
  const at = levelAt(w.site, name)
  if (at < 0) return fail(t('setup.err.thatLevelDoesNotExist'))
  if (patch.weight !== undefined && (!Number.isFinite(patch.weight) || patch.weight < 0)) return fail(t('setup.err.theWeightMustBe0OrMore'))
  return ok(withSite(w, (s) => ({ ...s, priorityLevels: s.priorityLevels.map((l, i) => (i === at ? { ...l, ...patch } : l)) })))
}

export function renameLevel(w: Workspace, name: string, to: string): Outcome {
  const at = levelAt(w.site, name)
  const next = to.trim()
  if (at < 0) return fail(t('setup.err.thatLevelDoesNotExist'))
  if (next === '') return fail(t('setup.err.nameNeeded'))
  if (w.site.priorityLevels.some((l, i) => i !== at && same(l.name, next))) return fail(t('setup.err.nameUsed'))
  return ok({
    ...withSite(w, (s) => ({ ...s, priorityLevels: s.priorityLevels.map((l, i) => (i === at ? { ...l, name: next } : l)) })),
    cases: w.cases.map((c) => (c.priorityLevel === name ? { ...c, priorityLevel: next } : c)),
    profiles: mapProfiles(w, (p) => ({ ...p, valueMaps: { ...p.valueMaps, priority: renameTargets(p.valueMaps.priority, name, next) } })),
  })
}

/** Moves a level one place up (-1, towards the lowest) or down (1). At the ends nothing changes. */
export function moveLevel(w: Workspace, name: string, direction: -1 | 1): Outcome {
  const at = levelAt(w.site, name)
  if (at < 0) return fail(t('setup.err.thatLevelDoesNotExist'))
  const to = at + direction
  if (to < 0 || to >= w.site.priorityLevels.length) return ok(w)
  return ok(withSite(w, (s) => {
    const list = [...s.priorityLevels]
    ;[list[at], list[to]] = [list[to], list[at]]
    return { ...s, priorityLevels: list }
  }))
}

export function removeLevel(w: Workspace, name: string): Outcome {
  const at = levelAt(w.site, name)
  if (at < 0) return fail(t('setup.err.thatLevelDoesNotExist'))
  if (w.site.priorityLevels.length === 1) return fail(t('setup.err.aSiteNeedsAtLeastOnePriority'))
  const used = w.cases.filter((c) => c.priorityLevel === name).length
  if (used > 0) return fail(tn('setup.err.casesUseLevel', used))
  return ok({
    ...withSite(w, (s) => ({ ...s, priorityLevels: s.priorityLevels.filter((_, i) => i !== at) })),
    profiles: mapProfiles(w, (p) => ({ ...p, valueMaps: { ...p.valueMaps, priority: dropTargets(p.valueMaps.priority, name) } })),
  })
}

// ---- places and aliases

const placeAt = (s: SiteProfile, name: string): number => s.places.findIndex((p) => p.name === name)

function checkCoordinates(lat: number | undefined, lon: number | undefined): string | null {
  if (lat !== undefined && (!Number.isFinite(lat) || lat < -90 || lat > 90)) return t('setup.err.latitudeMustBeBetween90And90')
  if (lon !== undefined && (!Number.isFinite(lon) || lon < -180 || lon > 180)) return t('setup.err.longitudeMustBeBetween180And180')
  return null
}

export function addPlace(w: Workspace, p: SitePlace): Outcome {
  const name = p.name.trim()
  if (name === '') return fail(t('setup.err.nameNeeded'))
  if (w.site.places.some((x) => same(x.name, name))) return fail(t('setup.err.nameUsed'))
  const bad = checkCoordinates(p.latitude, p.longitude)
  if (bad !== null) return fail(bad)
  const place: SitePlace = { name, latitude: p.latitude, longitude: p.longitude }
  if (p.postalCode !== undefined && p.postalCode.trim() !== '') place.postalCode = p.postalCode.trim()
  if (p.zone !== undefined && p.zone.trim() !== '') place.zone = p.zone.trim()
  return ok(withSite(w, (s) => ({ ...s, places: [...s.places, place] })))
}

export function updatePlace(w: Workspace, name: string, patch: Partial<Omit<SitePlace, 'name'>>): Outcome {
  const at = placeAt(w.site, name)
  if (at < 0) return fail(t('setup.err.thatPlaceDoesNotExist'))
  const bad = checkCoordinates(patch.latitude, patch.longitude)
  if (bad !== null) return fail(bad)
  const next: SitePlace = { ...w.site.places[at] }
  if (patch.latitude !== undefined) next.latitude = patch.latitude
  if (patch.longitude !== undefined) next.longitude = patch.longitude
  for (const k of ['postalCode', 'zone'] as const) {
    if (!(k in patch)) continue
    const v = patch[k]?.trim()
    if (v === undefined || v === '') delete next[k]
    else next[k] = v
  }
  return ok(withSite(w, (s) => ({ ...s, places: s.places.map((p, i) => (i === at ? next : p)) })))
}

export function renamePlace(w: Workspace, name: string, to: string): Outcome {
  const at = placeAt(w.site, name)
  const next = to.trim()
  if (at < 0) return fail(t('setup.err.thatPlaceDoesNotExist'))
  if (next === '') return fail(t('setup.err.nameNeeded'))
  if (w.site.places.some((p, i) => i !== at && same(p.name, next))) return fail(t('setup.err.nameUsed'))
  return ok({
    ...withSite(w, (s) => ({
      ...s,
      places: s.places.map((p, i) => (i === at ? { ...p, name: next } : p)),
      aliases: renameTargets(s.aliases, name, next),
    })),
    cases: w.cases.map((c) => (c.place === name ? { ...c, place: next } : c)),
    technicians: w.technicians.map((t) => ({
      ...t, ...(t.startPlace === name ? { startPlace: next } : {}), ...(t.endPlace === name ? { endPlace: next } : {}),
    })),
  })
}

export function removePlace(w: Workspace, name: string): Outcome {
  const at = placeAt(w.site, name)
  if (at < 0) return fail(t('setup.err.thatPlaceDoesNotExist'))
  const cases = w.cases.filter((c) => c.place === name).length
  if (cases > 0) return fail(tn('setup.err.casesUsePlace', cases))
  if (w.technicians.some((t) => t.startPlace === name || t.endPlace === name)) return fail(t('setup.err.aTechnicianStartsOrEndsTheDay'))
  return ok(withSite(w, (s) => ({ ...s, places: s.places.filter((_, i) => i !== at), aliases: dropTargets(s.aliases, name) })))
}

export function addAlias(w: Workspace, spelling: string, placeName: string): Outcome {
  const key = normaliseName(spelling)
  if (key === '') return fail(t('setup.err.writeTheSpellingToMatch'))
  const place = w.site.places.find((p) => p.name === placeName)
  if (place === undefined) return fail(t('setup.err.chooseAPlaceThatExists'))
  return ok(withSite(w, (s) => ({ ...s, aliases: { ...s.aliases, [key]: place.name } })))
}

export function removeAlias(w: Workspace, spelling: string): Workspace {
  const key = normaliseName(spelling)
  return withSite(w, (s) => ({ ...s, aliases: Object.fromEntries(Object.entries(s.aliases).filter(([k]) => normaliseName(k) !== key)) }))
}

// ---- technicians

const techAt = (w: Workspace, name: string): number => w.technicians.findIndex((t) => t.name === name)

function canonicalSkills(s: SiteProfile, names: string[]): string[] | null {
  const out: string[] = []
  for (const n of names) {
    const k = s.skills.find((x) => same(x, n))
    if (k === undefined) return null
    if (!out.includes(k)) out.push(k)
  }
  return out
}

export function addTechnician(w: Workspace, tech: { name: string; skills: string[] }): Outcome {
  const name = tech.name.trim()
  if (name === '') return fail(t('setup.err.nameNeeded'))
  if (w.technicians.some((x) => same(x.name, name))) return fail(t('setup.err.nameUsed'))
  const skills = canonicalSkills(w.site, tech.skills)
  if (skills === null) return fail(t('setup.err.chooseSkillsThatExist'))
  return ok({ ...w, technicians: [...w.technicians, { name, skills, active: true }] })
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
function isDate(text: string): boolean {
  if (!ISO.test(text)) return false
  const [y, m, d] = text.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

export function updateTechnician(w: Workspace, name: string, patch: Partial<Omit<ImportedTechnician, 'name'>>): Outcome {
  const at = techAt(w, name)
  if (at < 0) return fail(t('setup.err.thatTechnicianDoesNotExist'))
  const next: ImportedTechnician = { ...w.technicians[at] }
  const target = next as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete target[key]
      continue
    }
    if (key === 'skills') {
      const skills = canonicalSkills(w.site, value as string[])
      if (skills === null) return fail(t('setup.err.chooseSkillsThatExist'))
      next.skills = skills
    } else if (key === 'startPlace' || key === 'endPlace') {
      const p = w.site.places.find((x) => x.name === value)
      if (p === undefined) return fail(t('setup.err.chooseAPlaceThatExists'))
      next[key] = p.name
    } else if (key === 'leaveFrom' || key === 'leaveTo') {
      if (typeof value !== 'string' || !isDate(value)) return fail(t('setup.err.writeTheDateAsYearMonthDay'))
      next[key] = value
    } else if (key === 'shiftStart') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1439) return fail(t('setup.err.theShiftStartMustBeATime'))
      next.shiftStart = value
    } else if (key === 'shiftHours') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 24) return fail(t('setup.err.shiftHoursMustBeMoreThan0'))
      next.shiftHours = value
    } else if (key === 'breakMin') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fail(t('setup.err.theBreakMustBe0MinutesOr'))
      next.breakMin = value
    } else if (key === 'active') {
      next.active = value === true
    }
  }
  if (next.leaveFrom !== undefined && next.leaveTo !== undefined && next.leaveFrom > next.leaveTo) return fail(t('setup.err.theLeaveCannotEndBeforeItStarts'))
  return ok({ ...w, technicians: w.technicians.map((t, i) => (i === at ? next : t)) })
}

export function toggleTechnician(w: Workspace, name: string): Workspace {
  return { ...w, technicians: w.technicians.map((t) => (t.name === name ? { ...t, active: !t.active } : t)) }
}

export function removeTechnician(w: Workspace, name: string): Workspace {
  return { ...w, technicians: w.technicians.filter((t) => t.name !== name) }
}

// ---- holidays and the whole site

export function addHoliday(w: Workspace, iso: string): Outcome {
  if (!isDate(iso)) return fail(t('setup.err.writeTheDateAsYearMonthDay'))
  if (w.holidays.includes(iso)) return fail(t('setup.err.thatDayIsAlreadyAHoliday'))
  return ok({ ...w, holidays: [...w.holidays, iso].sort() })
}

export function removeHoliday(w: Workspace, iso: string): Workspace {
  return { ...w, holidays: w.holidays.filter((d) => d !== iso) }
}

export function replaceSite(w: Workspace, site: SiteProfile): Workspace {
  return { ...w, site }
}
