import { describe, expect, it } from 'vitest'
import { format, placeholders, translate, translatePlural } from './core'

describe('format', () => {
  it('fills placeholders by name, as often as they appear', () => {
    expect(format('Hello {name}, {name}!', { name: 'Asha' })).toBe('Hello Asha, Asha!')
    expect(format('{a} of {b}', { a: 3, b: 12 })).toBe('3 of 12')
  })
  it('leaves a placeholder without a value as written, so the gap shows', () => {
    expect(format('Hello {name}')).toBe('Hello {name}')
    expect(format('Hello {name}', { other: 'x' })).toBe('Hello {name}')
  })
  it('ignores values it has no placeholder for, and braces that are not placeholders', () => {
    expect(format('Plain', { name: 'x' })).toBe('Plain')
    expect(format('Set {} and { }', {})).toBe('Set {} and { }')
  })
  it('does not treat a replacement as a pattern', () => {
    expect(format('Price {p}', { p: '$&' })).toBe('Price $&')
  })
})

describe('placeholders', () => {
  it('lists the names once each, sorted', () => {
    expect(placeholders('{b} then {a} then {b}')).toEqual(['a', 'b'])
    expect(placeholders('none')).toEqual([])
  })
})

describe('translate', () => {
  const hi = { greet: 'नमस्ते {name}' }
  const en = { greet: 'Hello {name}', only: 'Only in English' }
  it('takes the first set that has the key', () => {
    expect(translate([hi, en], 'greet', { name: 'A' })).toBe('नमस्ते A')
  })
  it('falls back to the next set, and shows the key when no set has it', () => {
    expect(translate([hi, en], 'only')).toBe('Only in English')
    expect(translate([hi, en], 'missing.key')).toBe('missing.key')
  })
})

describe('translatePlural', () => {
  const en = { 'case.one': '{count} case', 'case.other': '{count} cases' }
  it('picks the form for the count in English, and fills the count', () => {
    expect(translatePlural([en], 'case', 1, 'en')).toBe('1 case')
    expect(translatePlural([en], 'case', 0, 'en')).toBe('0 cases')
    expect(translatePlural([en], 'case', 2, 'en')).toBe('2 cases')
  })
  it('writes the count in the way of the language', () => {
    expect(translatePlural([en], 'case', 1234, 'en')).toBe('1,234 cases')
  })
  it('lets other values fill other placeholders', () => {
    const set = { 'visit.one': '{count} visit for {name}', 'visit.other': '{count} visits for {name}' }
    expect(translatePlural([set], 'visit', 3, 'en', { name: 'Asha' })).toBe('3 visits for Asha')
  })
  it('uses the plural categories of the language: Arabic has six', () => {
    const ar = { 'c.zero': 'zero', 'c.one': 'one', 'c.two': 'two', 'c.few': 'few', 'c.many': 'many', 'c.other': 'other' }
    const out = [0, 1, 2, 3, 11, 100].map((n) => translatePlural([ar], 'c', n, 'ar'))
    expect(out).toEqual(['zero', 'one', 'two', 'few', 'many', 'other'])
  })
  it('counts 0 as singular in Hindi', () => {
    const hi = { 'c.one': 'एक', 'c.other': 'कई' }
    expect(translatePlural([hi], 'c', 0, 'hi')).toBe('एक')
    expect(translatePlural([hi], 'c', 2, 'hi')).toBe('कई')
  })
  it('falls back to the form "other", then to the next language, then shows the key', () => {
    const ar = { 'c.other': 'arabic other' }
    const en = { 'c.one': 'one', 'c.other': 'other', 'only.one': 'only one', 'only.other': 'only other' }
    expect(translatePlural([ar, en], 'c', 1, 'ar')).toBe('arabic other')
    expect(translatePlural([ar, en], 'only', 1, 'ar')).toBe('only one') // one in Arabic too, so English's "one" form fits
    expect(translatePlural([ar, en], 'only', 3, 'ar')).toBe('only other') // Arabic "few": English has none, so "other"
    expect(translatePlural([ar, en], 'nothing', 1, 'ar')).toBe('nothing')
  })
})
