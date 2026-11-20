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
    ['start place out of range', (i) => { i.technicians[0].startPlace = 2 }, 'technicians[0].startPlace must be at most 0'],
    ['end place out of range', (i) => { i.technicians[0].endPlace = 3 }, 'technicians[0].endPlace must be at most 0'],
    ['negative own usable minutes', (i) => { i.technicians[0].usableMin = -5 }, 'technicians[0].usableMin must be at least 0'],
    ['negative own day start', (i) => { i.technicians[0].dayStartMin = -1 }, 'technicians[0].dayStartMin must be at least 0'],
    ['negative own lunch start', (i) => { i.technicians[0].lunchStartMin = -1 }, 'technicians[0].lunchStartMin must be at least 0'],
    ['negative own break', (i) => { i.technicians[0].breakMin = -1 }, 'technicians[0].breakMin must be at least 0'],
    ['priority level that does not exist', (i) => { i.cases[0].priority = 5 }, 'cases[0].priority is 5 but only 2 priority levels exist'],
    ['negative priority', (i) => { i.cases[0].priority = -1 }, 'cases[0].priority must be at least 0'],
    ['no priority levels', (i) => { i.settings.priorityLevels = [] }, 'settings.priorityLevels must list at least one level'],
    ['priority level without a name', (i) => { i.settings.priorityLevels = [{ name: '', weight: 0 }] }, 'settings.priorityLevels[0].name must be text'],
    ['negative priority weight', (i) => { i.settings.priorityLevels = [{ name: 'A', weight: -1 }] }, 'settings.priorityLevels[0].weight must be at least 0'],
    ['fractional due day', (i) => { i.cases[0].dueDay = 1.5 }, 'cases[0].dueDay must be a whole number'],
    ['negative due weight', (i) => { i.settings.dueWeight = -1 }, 'settings.dueWeight must be at least 0'],
    ['negative urgency window', (i) => { i.settings.urgencyWindowDays = -1 }, 'settings.urgencyWindowDays must be at least 0'],
    ['product type that does not exist', (i) => { i.productTypes = [{ name: 'A' }]; i.cases[0].productType = 4 }, 'cases[0].productType is 4 but only 1 product types exist'],
    ['negative own visit minutes', (i) => { i.cases[0].serviceMin = -1 }, 'cases[0].serviceMin must be at least 0'],
    ['product without a name', (i) => { i.productTypes = [{ name: '' }] }, 'productTypes[0].name must be text'],
    ['product factor of zero', (i) => { i.productTypes = [{ name: 'A', factor: 0 }] }, 'productTypes[0].factor must be greater than 0'],
    ['product added minutes not a number', (i) => { i.productTypes = [{ name: 'A', addMin: NaN }] }, 'productTypes[0].addMin must be a finite number'],
  ]
  it.each(cases)('rejects %s', (_label, mutate, message) => {
    const input = valid()
    mutate(input)
    expect(() => checkInput(input)).toThrow(`Invalid planning input: ${message}`)
  })
})
