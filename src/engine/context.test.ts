import { expect, it } from 'vitest'
import { buildContext } from './context'
import { START, testInput } from './testing/fixtures'

it('builds the geometry once and maps each case to its node', () => {
  const input = testInput({
    places: [
      { name: 'A', lat: 20.1, lon: 30 },
      { name: 'B', lat: 20, lon: 30.1 },
    ],
    cases: [
      { id: '1', workType: 0, place: 1, escalated: false, reportedDay: START },
      { id: '2', workType: 1, place: 0, escalated: false, reportedDay: START },
    ],
  })
  const ctx = buildContext(input)
  expect(ctx.caseNode).toEqual([2, 1])
  expect(ctx.geo.tm.length).toBe(3)
  expect(ctx.s).toBe(input.settings)
  expect(ctx.cases).toBe(input.cases)
})
