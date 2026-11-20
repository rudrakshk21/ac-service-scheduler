import { describe, expect, it } from 'vitest'
import { IntakeError } from '../errors'
import { extendPlaces, parseSite, serializeSite, type SiteProfile } from './site'
import { starterSite } from './starter'

const site = (): SiteProfile => ({
  ...starterSite(),
  name: 'Test site',
  places: [
    { name: 'North Town', latitude: 20.1, longitude: 30.05, postalCode: '111111', zone: 'North' },
    { name: 'South Bay', latitude: 19.95, longitude: 30.1 },
  ],
  aliases: { 'n town': 'North Town' },
  columnNames: { caseId: ['Docket'] },
})
const clone = () => structuredClone(site()) as unknown as Record<string, any> // eslint-disable-line

describe('parseSite', () => {
  it('reads back what serializeSite wrote', () => {
    expect(parseSite(serializeSite(site()))).toEqual(site())
    expect(parseSite(serializeSite(starterSite()))).toEqual(starterSite())
  })
  it('keeps the optional due-date settings', () => {
    const s = site()
    s.settings.dueWeight = 10
    s.settings.urgencyWindowDays = 3
    expect(parseSite(serializeSite(s)).settings).toMatchObject({ dueWeight: 10, urgencyWindowDays: 3 })
  })
  const bad: [string, (s: ReturnType<typeof clone>) => void, string][] = [
    ['no version', (s) => { delete s.siteVersion }, 'Site profile: siteVersion must be 1'],
    ['a newer version', (s) => { s.siteVersion = 3 }, 'siteVersion is newer'],
    ['negative service minutes', (s) => { s.workTypes[0].serviceMin = -5 }, 'workTypes[0].serviceMin must be at least 0'],
    ['a zero ceiling', (s) => { s.workTypes[0].dailyCeiling = 0 }, 'workTypes[0].dailyCeiling must be greater than 0'],
    ['an empty skills list', (s) => { s.skills = [] }, 'skills must list at least one skill'],
    ['no work types', (s) => { s.workTypes = [] }, 'workTypes must list at least one work type'],
    ['a required skill that does not exist', (s) => { s.workTypes[1].requiredSkill = 7 }, 'workTypes[1].requiredSkill must be at most 2'],
    ['a priority level without a name', (s) => { s.priorityLevels[0].name = '' }, 'priorityLevels[0].name must be text'],
    ['a negative priority weight', (s) => { s.priorityLevels[1].weight = -1 }, 'priorityLevels[1].weight must be at least 0'],
    ['no priority levels', (s) => { s.priorityLevels = [] }, 'priorityLevels must list at least one level'],
    ['a latitude out of range', (s) => { s.places[0].latitude = 95 }, 'places[0].latitude must be at most 90'],
    ['a place used twice', (s) => { s.places[1].name = 'north TOWN' }, 'places[1].name "north TOWN" is used twice'],
    ['an alias to an unknown place', (s) => { s.aliases['x'] = 'Nowhere' }, 'aliases["x"] points to "Nowhere", which is not in the place table'],
    ['a zero speed', (s) => { s.settings.speedKmh = 0 }, 'settings.speedKmh must be greater than 0'],
    ['a zero road factor', (s) => { s.settings.roadFactor = 0 }, 'settings.roadFactor must be greater than 0'],
    ['a rest weekday out of range', (s) => { s.settings.restWeekdays = [7] }, 'settings.restWeekdays[0] must be at most 6'],
    ['a flag that is not true or false', (s) => { s.keepAssignedTechnician = 'yes' }, 'keepAssignedTechnician must be true or false'],
    ['column names that are not lists', (s) => { s.columnNames = { caseId: 'Docket' } }, 'columnNames.caseId must be a list'],
  ]
  it.each(bad)('rejects %s with a message that names the field', (_label, mutate, message) => {
    const s = clone()
    mutate(s)
    expect(() => parseSite(JSON.stringify(s))).toThrow(message)
    try {
      parseSite(JSON.stringify(s))
    } catch (e) {
      expect(e).toBeInstanceOf(IntakeError)
      expect((e as IntakeError).code).toBe('bad_site')
    }
  })
  it('rejects text that is not JSON', () => {
    expect(() => parseSite('nope')).toThrow('not valid JSON')
  })
})

describe('extendPlaces', () => {
  it('adds new places once, skips names already there (any case), and does not change its input', () => {
    const before = site()
    const frozen = JSON.stringify(before)
    const out = extendPlaces(before, [
      { name: 'East Side', latitude: 20, longitude: 30.3 },
      { name: 'EAST side', latitude: 1, longitude: 1 },
      { name: 'north town', latitude: 2, longitude: 2 },
    ])
    expect(out.places.map((p) => p.name)).toEqual(['North Town', 'South Bay', 'East Side'])
    expect(out.places[2].latitude).toBe(20)
    expect(JSON.stringify(before)).toBe(frozen)
  })
})
