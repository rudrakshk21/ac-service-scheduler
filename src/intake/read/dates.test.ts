import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { detectDateOrder, parseDate, serialToIso, type DateOrder } from './dates'

describe('parseDate', () => {
  it('reads ISO dates and keeps the calendar date as written', () => {
    for (const v of ['2026-10-13', '2026-10-13T08:30:00Z', '2026-10-13 08:30:00+05:30', '2026-10-13T23:59:00-08:00', '2026-1-3']) {
      expect(parseDate(v, null)).toBe(v === '2026-1-3' ? '2026-01-03' : '2026-10-13')
    }
  })
  it.each<[string, DateOrder]>([
    ['13/10/2026', 'dmy'], ['13-10-2026', 'dmy'], ['13.10.2026', 'dmy'], ['13/10/26', 'dmy'],
    ['10/13/2026', 'mdy'], ['2026/10/13', 'ymd'], ['2026.10.13', 'ymd'],
  ])('reads %s with order %s', (text, order) => {
    expect(parseDate(text, order)).toBe('2026-10-13')
  })
  it('reads month names whatever the order', () => {
    for (const v of ['13 Oct 2026', '13 October 2026', 'Oct 13, 2026', '13-Oct-26', 'October 13 2026', '13 oct. 2026']) {
      expect(parseDate(v, null)).toBe('2026-10-13')
      expect(parseDate(v, 'mdy')).toBe('2026-10-13')
    }
  })
  it('maps two-digit years: 00 to 69 to the 2000s, 70 to 99 to the 1900s', () => {
    expect(parseDate('01/02/70', 'dmy')).toBe('1970-02-01')
    expect(parseDate('01/02/69', 'dmy')).toBe('2069-02-01')
  })
  it('without an order reads only dates that are unambiguous', () => {
    expect(parseDate('13/10/2026', null)).toBe('2026-10-13')
    expect(parseDate('10/13/2026', null)).toBe('2026-10-13')
    expect(parseDate('04/05/2026', null)).toBeNull()
    expect(parseDate('05/05/2026', null)).toBe('2026-05-05')
    expect(parseDate('13/10/2026', 'ymd')).toBeNull()
  })
  it('reads Date cells by their UTC parts and spreadsheet serial numbers', () => {
    expect(parseDate(new Date(Date.UTC(2026, 9, 13, 23, 0)), null)).toBe('2026-10-13')
    expect(serialToIso(25569)).toBe('1970-01-01')
    expect(serialToIso(46308)).toBe('2026-10-13')
    expect(parseDate(46308, null)).toBe('2026-10-13')
    expect(parseDate(46308.75, null)).toBe('2026-10-13')
    expect(parseDate(12, null)).toBeNull()
  })
  it('returns null for things that are not dates', () => {
    for (const v of ['31/02/2026', '2026-13-01', 'hello', '', '   ', '13 Foo 2026', '32/01/2026']) expect(parseDate(v, 'dmy')).toBeNull()
    expect(parseDate(null, null)).toBeNull()
    expect(parseDate(true, null)).toBeNull()
    expect(parseDate(new Date('nope'), null)).toBeNull()
  })
  it('knows leap years', () => {
    expect(parseDate('29/02/2028', 'dmy')).toBe('2028-02-29')
    expect(parseDate('29/02/2026', 'dmy')).toBeNull()
  })
  it('reads back dates written in every supported style (random)', () => {
    const p = (n: number, w = 2) => String(n).padStart(w, '0')
    fc.assert(
      fc.property(fc.integer({ min: 1970, max: 2069 }), fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 28 }), fc.boolean(), (y, m, d, padded) => {
        const want = `${y}-${p(m)}-${p(d)}`
        const a = padded ? p(d) : String(d)
        const b = padded ? p(m) : String(m)
        expect(parseDate(`${a}/${b}/${y}`, 'dmy')).toBe(want)
        expect(parseDate(`${b}/${a}/${y}`, 'mdy')).toBe(want)
        expect(parseDate(`${y}/${b}/${a}`, 'ymd')).toBe(want)
        expect(parseDate(want, null)).toBe(want)
      }),
      { numRuns: 300 },
    )
  })
})

describe('detectDateOrder', () => {
  it('decides day-first, month-first and year-first from the values', () => {
    expect(detectDateOrder(['13/10/2026', '01/02/2026'])).toEqual({ order: 'dmy', ambiguous: false })
    expect(detectDateOrder(['10/13/2026', '01/02/2026'])).toEqual({ order: 'mdy', ambiguous: false })
    expect(detectDateOrder(['2026-10-13'])).toEqual({ order: 'ymd', ambiguous: false })
    expect(detectDateOrder(['2026-10-13T08:30:00Z', '2026-10-14 09:00:00'])).toEqual({ order: 'ymd', ambiguous: false })
  })
  it('asks the user when the day and month cannot be told apart, or when the column disagrees with itself', () => {
    expect(detectDateOrder(['01/02/2026', '03/04/2026'])).toEqual({ order: null, ambiguous: true })
    expect(detectDateOrder(['13/10/2026', '10/13/2026'])).toEqual({ order: null, ambiguous: true })
    expect(detectDateOrder(['2026-10-13', '13/10/2026'])).toEqual({ order: null, ambiguous: true })
  })
  it('says nothing when there are no numeric dates', () => {
    expect(detectDateOrder(['hello', '', '13 Oct 2026'])).toEqual({ order: null, ambiguous: false })
    expect(detectDateOrder([])).toEqual({ order: null, ambiguous: false })
  })
  it('looks at no more than 200 values', () => {
    const many = [...Array.from({ length: 200 }, () => '01/02/2026'), '13/10/2026']
    expect(detectDateOrder(many)).toEqual({ order: null, ambiguous: true })
  })
})
