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

  it('plans a high-priority level first and names it in the reason', () => {
    const levels = [{ name: 'Low', weight: 0 }, { name: 'Emergency', weight: 100000 }]
    const cases = [aCase('1', 0), aCase('2', 0), aCase('3', 0), aCase('4', 0, { priority: 1 })]
    const r = plan(testInput({
      settings: testSettings({ priorityLevels: levels }), places: [here], technicians: [tech('T', [0])], cases,
    }))
    const s = r.scheduled.find((x) => x.id === '4')
    expect(s?.day).toBe(START)
    expect(s?.why.endsWith('; priority Emergency')).toBe(true)
    expect(r.scheduled.find((x) => x.id === '1')?.why.includes('priority')).toBe(false)
  })

  it('flags a visit after its due day and leaves other cases alone', () => {
    const r = plan(testInput({
      places: [here], technicians: [tech('T', [0])],
      cases: ['1', '2', '3', '4'].map((id, i) => aCase(id, 0, i === 3 ? { dueDay: START - 2 } : {})),
    }))
    expect(r.scheduled.find((s) => s.id === '4')?.flag).toBe('LATE BY 2 DAYS')
    expect(r.scheduled.filter((s) => s.flag !== '').length).toBe(1)
  })

  it('says "1 DAY" in the singular', () => {
    const r = plan(testInput({
      places: [here], technicians: [tech('T', [0])], cases: [aCase('1', 0, { dueDay: START - 1 })],
    }))
    expect(r.scheduled[0].flag).toBe('LATE BY 1 DAY')
  })

  it('pulls a case with a near due day ahead of cases that have waited longer', () => {
    // All at one place, so only the bonuses decide: age 2 days = 8 points, due today = 8 x 5 = 40 points.
    const waited = (id: string) => aCase(id, 0, { reportedDay: START - 2 })
    const plain = [waited('1'), waited('2'), waited('3'), aCase('4', 0)]
    const urgent = [waited('1'), waited('2'), waited('3'), aCase('4', 0, { dueDay: START })]
    const dayOfFour = (cases: object[]) =>
      plan(testInput({ places: [here], technicians: [tech('T', [0])], cases: cases as ReturnType<typeof aCase>[] }))
        .scheduled.find((s) => s.id === '4')?.day
    expect(dayOfFour(plain)).toBe(START + 1) // the ceiling is 3 a day and the others are older
    expect(dayOfFour(urgent)).toBe(START) // the due date pulls it into the first day
  })

  it('adds "due date missed" to a case that never fits', () => {
    const r = plan(testInput({
      settings: testSettings({ horizonDays: 1 }), places: [here], technicians: [tech('T', [0])],
      cases: ['1', '2', '3', '4'].map((id) => aCase(id, 0, { dueDay: START })),
    }))
    expect(r.unscheduled[0].reason).toBe('Beyond planning horizon (1 working days) or does not fit in a day; due date missed')
  })

  it('joins the late flag to an over-capacity flag', () => {
    // Four 120-minute pinned jobs on one day are over capacity; one of them is also past its due day.
    const cases = ['1', '2', '3', '4'].map((id, i) =>
      aCase(id, 0, { pinnedTech: 0, earliestDay: START, ...(i === 0 ? { dueDay: START - 1 } : {}) }))
    const r = plan(testInput({ places: [here], technicians: [tech('T', [0])], cases }))
    expect(r.scheduled.find((s) => s.id === '1')?.flag).toBe('OVER CAPACITY; LATE BY 1 DAY')
    expect(r.scheduled.find((s) => s.id === '2')?.flag).toBe('OVER CAPACITY')
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
