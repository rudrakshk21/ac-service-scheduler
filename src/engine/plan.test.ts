import { describe, expect, it } from 'vitest'
import { dayNumber } from './calendar'
import { plan } from './index'
import { START, testInput, testSettings } from './testing/fixtures'

const here = { name: 'Here', lat: 20, lon: 30 } // exactly at the base
const tech = (name: string, skills: number[]) => ({ name, skills, active: true })
const aCase = (id: string, workType: number, extra: object = {}) => ({
  id, workType, place: 0, escalated: false, reportedDay: START, ...extra,
})

describe('plan (hand-checked cases; the golden files do the rigorous work)', () => {
  it('schedules one case with a plain-language reason', () => {
    const r = plan(testInput({ places: [here], technicians: [tech('Technician 01', [0])], cases: [aCase('1', 0)] }))
    expect(r.scheduled).toEqual([{
      id: '1', day: START, tech: 0, visit: 1, eta: '09:05', travelMin: 5, prevKm: 0, flag: '',
      why: 'Skill match (Technician 01 approved for Installation); adds 10 min detour; route of 1 stop in Central',
    }])
    expect(r.unscheduled).toEqual([])
    expect(r.days).toEqual([START])
  })

  it('leaves a case unscheduled when nobody has the skill', () => {
    const r = plan(testInput({ places: [here], technicians: [tech('T', [1])], cases: [aCase('1', 0)] }))
    expect(r.scheduled).toEqual([])
    expect(r.unscheduled).toEqual([{ id: '1', reason: 'No active technician has this skill' }])
  })

  it('skips the rest day', () => {
    const sunday = dayNumber('2026-10-18')
    const r = plan(testInput({
      settings: testSettings({ startDay: sunday }), places: [here], technicians: [tech('T', [0])], cases: [aCase('1', 0)],
    }))
    expect(r.scheduled[0].day).toBe(dayNumber('2026-10-19'))
  })

  it('moves what exceeds the daily ceiling to the next working day', () => {
    const cases = ['1', '2', '3', '4'].map((id) => aCase(id, 0))
    const r = plan(testInput({ places: [here], technicians: [tech('T', [0])], cases }))
    expect(r.scheduled.filter((s) => s.day === START).length).toBe(3)
    expect(r.scheduled.filter((s) => s.day === START + 1).length).toBe(1)
  })

  it('plans an escalated case first even when it comes last', () => {
    const cases = [aCase('1', 0), aCase('2', 0), aCase('3', 0), aCase('4', 0, { escalated: true })]
    const r = plan(testInput({ places: [here], technicians: [tech('T', [0])], cases }))
    expect(r.scheduled.find((s) => s.id === '4')?.day).toBe(START)
  })

  it('places a pinned case on its day with the manual technician', () => {
    const r = plan(testInput({
      places: [here],
      technicians: [tech('T0', [0]), tech('T1', [0])],
      cases: [aCase('1', 0, { pinnedTech: 1, earliestDay: START + 1 })],
    }))
    expect(r.scheduled[0]).toMatchObject({ day: START + 1, tech: 1, why: 'Manual assignment' })
  })

  it('waits for a technician to come back from leave', () => {
    const r = plan(testInput({
      places: [here],
      technicians: [{ ...tech('T', [0]), leaveFrom: START, leaveTo: START }],
      cases: [aCase('1', 0)],
    }))
    expect(r.scheduled[0].day).toBe(START + 1)
  })

  it('reports what does not fit inside the planning horizon', () => {
    const cases = ['1', '2', '3', '4'].map((id) => aCase(id, 0))
    const r = plan(testInput({
      settings: testSettings({ horizonDays: 1 }), places: [here], technicians: [tech('T', [0])], cases,
    }))
    expect(r.unscheduled).toEqual([{
      id: expect.any(String),
      reason: 'Beyond planning horizon (1 working days) or does not fit in a day',
    }])
  })

  it('rejects invalid input with a message that names the field', () => {
    expect(() => plan(testInput({ places: [{ name: 'P', lat: NaN, lon: 0 }] }))).toThrow('places[0].lat')
  })
})
