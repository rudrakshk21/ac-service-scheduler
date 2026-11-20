import { describe, expect, it } from 'vitest'
import { starterSite } from '../site/starter'
import type { MappingProfile } from './profile'
import { mapPriority, mapSkills, mapStatus, mapWorkType, normaliseValue, splitList } from './values'

const site = starterSite()
const profile = (over: Partial<MappingProfile> = {}): MappingProfile => ({
  profileVersion: 1, name: 'p', kind: 'cases', fingerprint: 'x', formats: {}, columns: { workType: ['Category'] },
  valueMaps: {
    workType: { 'ac repair': 'Service', 'new unit': 'Installation' },
    status: { 'pending parts': 'hold', closed: 'ignore' },
    priority: { p1: 'Escalated' },
    skill: { 'split service': 'Service', 'ac fitting': 'Installation' },
  },
  ...over,
})

describe('splitList', () => {
  it('splits on commas, semicolons, slashes, bars and line breaks and drops empties', () => {
    expect(splitList('a, b;c / d|e\nf,, ')).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(splitList('')).toEqual([])
  })
})

describe('mapWorkType', () => {
  it('uses the profile map, ignoring case, accents and spacing', () => {
    expect(mapWorkType(profile(), site, ' AC  Repair ')).toEqual({ name: 'Service', unknown: null })
    expect(normaliseValue('AC  Repair')).toBe('ac repair')
  })
  it('accepts a value equal to a site work type name without a map entry', () => {
    expect(mapWorkType(profile(), site, 'breakdown')).toEqual({ name: 'Breakdown', unknown: null })
  })
  it('uses the single work type of a file without a category column', () => {
    const p = profile({ columns: {}, singleWorkType: 'Service' })
    expect(mapWorkType(p, site, undefined)).toEqual({ name: 'Service', unknown: null })
    expect(mapWorkType(p, site, 'anything')).toEqual({ name: 'Service', unknown: null })
  })
  it('reports an unknown value, or an empty one', () => {
    expect(mapWorkType(profile(), site, 'Deep clean')).toEqual({ name: null, unknown: 'Deep clean' })
    expect(mapWorkType(profile(), site, undefined)).toEqual({ name: null, unknown: '(empty)' })
    expect(mapWorkType(profile(), site, '  ')).toEqual({ name: null, unknown: '(empty)' })
  })
})

describe('mapStatus', () => {
  it('maps words to actions, and no status or an unknown word to schedule', () => {
    expect(mapStatus(profile(), 'Pending Parts')).toEqual({ action: 'hold', unknown: null })
    expect(mapStatus(profile(), 'CLOSED')).toEqual({ action: 'ignore', unknown: null })
    expect(mapStatus(profile(), undefined)).toEqual({ action: 'schedule', unknown: null })
    expect(mapStatus(profile(), 'Waiting')).toEqual({ action: 'schedule', unknown: 'Waiting' })
  })
})

describe('mapPriority', () => {
  it('maps through the profile or by level name, and reports unknown values', () => {
    expect(mapPriority(profile(), site, 'P1')).toEqual({ level: 'Escalated', unknown: null })
    expect(mapPriority(profile(), site, 'normal')).toEqual({ level: 'Normal', unknown: null })
    expect(mapPriority(profile(), site, undefined)).toEqual({ level: null, unknown: null })
    expect(mapPriority(profile(), site, 'P9')).toEqual({ level: null, unknown: 'P9' })
  })
})

describe('mapSkills', () => {
  it('maps several values in order without repeats, and lists unknown pieces', () => {
    expect(mapSkills(profile(), site, 'AC fitting, Split service')).toEqual({ skills: ['Installation', 'Service'], unknown: [] })
    expect(mapSkills(profile(), site, 'Service; split service; Plumbing; Plumbing')).toEqual({ skills: ['Service'], unknown: ['Plumbing'] })
  })
  it('flattens several columns', () => {
    expect(mapSkills(profile(), site, ['AC fitting', 'Breakdown'])).toEqual({ skills: ['Installation', 'Breakdown'], unknown: [] })
  })
})
