import { describe, expect, it } from 'vitest'
import { longDate, madeText } from './format'

describe('longDate', () => {
  it('writes the weekday, day, month and year in full, whatever the time zone of the computer', () => {
    const text = longDate('2026-11-22')
    expect(text).toMatch(/Sunday/)
    expect(text).toMatch(/22/)
    expect(text).toMatch(/November/)
    expect(text).toMatch(/2026/)
  })
  it('gives the text back when it is not a date', () => {
    expect(longDate('soon')).toBe('soon')
  })
})

describe('madeText', () => {
  it('writes the date and time a pack was made', () => {
    const text = madeText('2026-11-21T14:05:00.000Z')
    expect(text).toMatch(/2026/)
    expect(text).toMatch(/Nov/)
    expect(text).toMatch(/\d{1,2}:\d{2}/)
  })
  it('gives the text back when it is not a time', () => {
    expect(madeText('later')).toBe('later')
  })
})
