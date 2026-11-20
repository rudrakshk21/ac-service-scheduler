import { DEFAULT_LEVELS } from '../../engine/context'
import type { SiteProfile } from './site'

/**
 * The starter template of a new site: three work types, three skills, the two default priority levels and the rule
 * values validated on the reference data set (DS-1). The base location is a placeholder: every site sets its own.
 */
export function starterSite(): SiteProfile {
  return {
    siteVersion: 1,
    name: 'New site',
    settings: {
      baseLat: 20, baseLon: 30,
      speedKmh: 30, roadFactor: 1.35, sameAreaHopMin: 10,
      usableMin: 480, dayStartMin: 540, lunchStartMin: 780, breakMin: 60,
      ageWeight: 4, balanceWeight: 0.05, maxKm: 60, horizonDays: 30,
      restWeekdays: [6],
    },
    workTypes: [
      { name: 'Installation', serviceMin: 120, dailyCeiling: 3, requiredSkill: 0 },
      { name: 'Service', serviceMin: 75, dailyCeiling: 5, requiredSkill: 1 },
      { name: 'Breakdown', serviceMin: 75, dailyCeiling: 5, requiredSkill: 2 },
    ],
    skills: ['Installation', 'Service', 'Breakdown'],
    priorityLevels: DEFAULT_LEVELS.map((l) => ({ ...l })),
    places: [],
    aliases: {},
    keepAssignedTechnician: true,
    columnNames: {},
  }
}
