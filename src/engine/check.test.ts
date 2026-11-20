import { describe, expect, it } from 'vitest'
import { checkInput } from './check'
import type { PlanInput } from './types'
import { START, testInput } from './testing/fixtures'

function valid(): PlanInput {
  return testInput({
    technicians: [{ name: 'T1', skills: [0], active: true }],
    places: [{ name: 'A', lat: 20.1, lon: 30 }],
    cases: [{ id: '1', workType: 0, place: 0, escalated: false, reportedDay: START }],
  })
}

describe('checkInput', () => {
  it('accepts a valid input and an empty one', () => {
    expect(() => checkInput(valid())).not.toThrow()
    expect(() => checkInput(testInput())).not.toThrow()
  })

  const cases: [string, (i: PlanInput) => void, string][] = [
    ['speed of zero', (i) => { i.settings.speedKmh = 0 }, 'settings.speedKmh must be greater than 0'],
    ['negative usable minutes', (i) => { i.settings.usableMin = -1 }, 'settings.usableMin must be at least 0'],
    ['latitude out of range', (i) => { i.settings.baseLat = 95 }, 'settings.baseLat must be between -90 and 90'],
    ['rest weekday out of range', (i) => { i.settings.restWeekdays = [7] }, 'settings.restWeekdays[0] must be at most 6'],
    ['fractional horizon', (i) => { i.settings.horizonDays = 2.5 }, 'settings.horizonDays must be a whole number'],
    ['no work types', (i) => { i.workTypes = [] }, 'workTypes must list at least one work type'],
    ['zero ceiling', (i) => { i.workTypes[0].dailyCeiling = 0 }, 'workTypes[0].dailyCeiling must be greater than 0'],
    ['negative service time', (i) => { i.workTypes[1].serviceMin = -5 }, 'workTypes[1].serviceMin must be at least 0'],
    ['missing coordinate', (i) => { i.places[0].lat = NaN }, 'places[0].lat must be a finite number'],
    ['longitude out of range', (i) => { i.places[0].lon = 200 }, 'places[0].lon must be between -180 and 180'],
    ['case place out of range', (i) => { i.cases[0].place = 3 }, 'cases[0].place must be at most 0'],
    ['case work type out of range', (i) => { i.cases[0].workType = 3 }, 'cases[0].workType must be at most 2'],
    ['duplicate case id', (i) => { i.cases.push({ ...i.cases[0] }) }, 'cases[1].id "1" is used twice'],
    ['pinned technician out of range', (i) => { i.cases[0].pinnedTech = 4 }, 'cases[0].pinnedTech must be at most 0'],
    ['negative skill', (i) => { i.technicians[0].skills = [-1] }, 'technicians[0].skills[0] must be at least 0'],
    ['non-boolean active flag', (i) => { (i.technicians[0] as unknown as { active: unknown }).active = 'yes' }, 'technicians[0].active must be true or false'],
  ]
  it.each(cases)('rejects %s', (_label, mutate, message) => {
    const input = valid()
    mutate(input)
    expect(() => checkInput(input)).toThrow(`Invalid planning input: ${message}`)
  })
})
