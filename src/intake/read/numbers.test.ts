import { describe, expect, it } from 'vitest'
import { detectDecimal, parseNumber } from './numbers'

describe('parseNumber', () => {
  it('reads both decimal marks and thousands separators', () => {
    expect(parseNumber('1,234.56', '.')).toBe(1234.56)
    expect(parseNumber('1.234,56', ',')).toBe(1234.56)
    expect(parseNumber('2,5', ',')).toBe(2.5)
    expect(parseNumber('-3.5', '.')).toBe(-3.5)
    expect(parseNumber('.5', '.')).toBe(0.5)
  })
  it('ignores spaces, including non-breaking ones', () => {
    expect(parseNumber(' 7 ', '.')).toBe(7)
    expect(parseNumber('1 234,5', ',')).toBe(1234.5)
    expect(parseNumber('1 234,5', ',')).toBe(1234.5)
  })
  it('passes number cells through and rejects the rest', () => {
    expect(parseNumber(12.5, ',')).toBe(12.5)
    expect(parseNumber(Number.NaN, '.')).toBeNull()
    for (const v of ['', 'abc', '1.2.3', '12a']) expect(parseNumber(v, '.')).toBeNull()
    expect(parseNumber(null, '.')).toBeNull()
    expect(parseNumber(true, '.')).toBeNull()
    expect(parseNumber(new Date(), '.')).toBeNull()
  })
})

describe('detectDecimal', () => {
  it('finds the decimal mark', () => {
    expect(detectDecimal(['2,5', '10,75'])).toBe(',')
    expect(detectDecimal(['2.5', '10.75'])).toBe('.')
    expect(detectDecimal(['1.234,5'])).toBe(',')
    expect(detectDecimal(['1,234.5'])).toBe('.')
    expect(detectDecimal(['8.5241', '76.9366', '8,5'])).toBeNull() // both marks as decimals: conflict
  })
  it('gives the point for whole numbers and for no numbers', () => {
    expect(detectDecimal(['1', '22', '333'])).toBe('.')
    expect(detectDecimal([])).toBe('.')
    expect(detectDecimal(['abc', ''])).toBe('.')
  })
  it('asks the user when the values could be thousands', () => {
    expect(detectDecimal(['1,234', '5,678'])).toBeNull()
    expect(detectDecimal(['1.234', '5.678'])).toBeNull()
  })
})
