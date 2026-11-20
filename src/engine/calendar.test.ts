import { describe, expect, it } from 'vitest'
import { dayNumber, isAvailable, makeCalendar, weekday } from './calendar'
import { START, testSettings } from './testing/fixtures'

describe('dayNumber and weekday', () => {
  it('counts days from 1970-01-01, a Thursday', () => {
    expect(dayNumber('1970-01-01')).toBe(0)
    expect(dayNumber('1970-01-02')).toBe(1)
    expect(dayNumber('1969-12-31')).toBe(-1)
    expect(weekday(0)).toBe(3)
    expect(weekday(-1)).toBe(2)
  })
  it('knows the weekdays of the reference dates', () => {
    expect(weekday(dayNumber('2026-10-13'))).toBe(1) // Tuesday
    expect(weekday(dayNumber('2026-10-18'))).toBe(6) // Sunday
    expect(weekday(dayNumber('2026-10-19'))).toBe(0) // Monday
  })
  it('START is 2026-10-13', () => {
    expect(START).toBe(dayNumber('2026-10-13'))
  })
})

describe('makeCalendar', () => {
  it('skips rest days and holidays', () => {
    const cal = makeCalendar(testSettings({ restWeekdays: [6], holidays: [START + 2] }))
    expect(cal.isWorkday(START)).toBe(true)
    expect(cal.isWorkday(START + 2)).toBe(false) // holiday
    expect(cal.isWorkday(dayNumber('2026-10-18'))).toBe(false) // Sunday
  })
  it('lets Sunday be a working day when no rest day is set', () => {
    const cal = makeCalendar(testSettings({ restWeekdays: [] }))
    expect(cal.isWorkday(dayNumber('2026-10-18'))).toBe(true)
  })
})

describe('isAvailable', () => {
  const tech = { name: 'T', skills: [0], active: true }
  it('is false for an inactive technician', () => {
    expect(isAvailable({ ...tech, active: false }, START)).toBe(false)
  })
  it('is false inside the leave range, true outside it', () => {
    const t = { ...tech, leaveFrom: START + 1, leaveTo: START + 2 }
    expect(isAvailable(t, START)).toBe(true)
    expect(isAvailable(t, START + 1)).toBe(false)
    expect(isAvailable(t, START + 2)).toBe(false)
    expect(isAvailable(t, START + 3)).toBe(true)
  })
  it('treats a leave without an end date as open ended', () => {
    const t = { ...tech, leaveFrom: START + 1 }
    expect(isAvailable(t, START)).toBe(true)
    expect(isAvailable(t, START + 50)).toBe(false)
  })
})
