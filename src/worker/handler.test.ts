import { describe, expect, it } from 'vitest'
import { START, testInput } from '../engine/testing/fixtures'
import { handlePlanRequest } from './handler'

describe('handlePlanRequest', () => {
  it('returns the plan on valid input', () => {
    const input = testInput({
      places: [{ name: 'Here', lat: 20, lon: 30 }],
      technicians: [{ name: 'T', skills: [0], active: true }],
      cases: [{ id: '1', workType: 0, place: 0, escalated: false, reportedDay: START }],
    })
    const reply = handlePlanRequest(input)
    expect(reply.ok).toBe(true)
    if (reply.ok) expect(reply.result.scheduled.length).toBe(1)
  })

  it('returns the message instead of throwing on invalid input', () => {
    const reply = handlePlanRequest(testInput({ places: [{ name: 'P', lat: NaN, lon: 0 }] }))
    expect(reply).toEqual({ ok: false, error: 'Invalid planning input: places[0].lat must be a finite number' })
  })
})
