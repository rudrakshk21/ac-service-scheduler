import type { SiteProfile } from '../site/site'
import { normaliseName, type StatusAction } from './model'
import type { MappingProfile } from './profile'

/** Normalised form of a source value, the key of every value map. */
export const normaliseValue = normaliseName

/** Splits a cell that holds several values on `,` `;` `/` `|` and line breaks. */
export function splitList(value: string): string[] {
  return value.split(/[,;/|\n\r]+/).map((s) => s.trim()).filter((s) => s !== '')
}

const EMPTY = '(empty)'

function byName<T extends { name: string }>(list: readonly T[], key: string): T | undefined {
  return list.find((x) => normaliseValue(x.name) === key)
}

/** The site work type a source value maps to. An unknown value sends the case to review. */
export function mapWorkType(
  profile: MappingProfile, site: SiteProfile, source: string | undefined,
): { name: string | null; unknown: string | null } {
  const key = source === undefined ? '' : normaliseValue(source)
  if (key === '') {
    if (profile.singleWorkType !== undefined) return { name: profile.singleWorkType, unknown: null }
    return { name: null, unknown: EMPTY }
  }
  const mapped = profile.valueMaps.workType[key]
  if (mapped !== undefined) return { name: mapped, unknown: null }
  const own = byName(site.workTypes, key)
  if (own !== undefined) return { name: own.name, unknown: null }
  if (profile.singleWorkType !== undefined && Object.keys(profile.columns).every((f) => f !== 'workType')) {
    return { name: profile.singleWorkType, unknown: null }
  }
  return { name: null, unknown: (source ?? '').trim() }
}

/** The action a status word maps to. No status means schedulable; an unknown word is schedulable and reported. */
export function mapStatus(
  profile: MappingProfile, source: string | undefined,
): { action: StatusAction; unknown: string | null } {
  const key = source === undefined ? '' : normaliseValue(source)
  if (key === '') return { action: 'schedule', unknown: null }
  const mapped = profile.valueMaps.status[key]
  if (mapped !== undefined) return { action: mapped, unknown: null }
  return { action: 'schedule', unknown: (source ?? '').trim() }
}

/** The priority level a source value maps to. No value means the lowest level (reported as null). */
export function mapPriority(
  profile: MappingProfile, site: SiteProfile, source: string | undefined,
): { level: string | null; unknown: string | null } {
  const key = source === undefined ? '' : normaliseValue(source)
  if (key === '') return { level: null, unknown: null }
  const mapped = profile.valueMaps.priority[key]
  if (mapped !== undefined) return { level: mapped, unknown: null }
  const own = byName(site.priorityLevels, key)
  if (own !== undefined) return { level: own.name, unknown: null }
  return { level: null, unknown: (source ?? '').trim() }
}

/** Skill names for one cell or several (the values of several columns), without repeats, in order. */
export function mapSkills(
  profile: MappingProfile, site: SiteProfile, source: string | string[],
): { skills: string[]; unknown: string[] } {
  const pieces = (Array.isArray(source) ? source : [source]).flatMap(splitList)
  const skills: string[] = []
  const unknown: string[] = []
  for (const piece of pieces) {
    const key = normaliseValue(piece)
    const name = profile.valueMaps.skill[key] ?? site.skills.find((s) => normaliseValue(s) === key)
    if (name === undefined) {
      if (!unknown.includes(piece)) unknown.push(piece)
    } else if (!skills.includes(name)) {
      skills.push(name)
    }
  }
  return { skills, unknown }
}
