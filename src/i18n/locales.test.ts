import { describe, expect, it } from 'vitest'
import { intlLocale, isKnown, LOCALES, pickLocale, selectable } from './locales'

describe('the list of languages', () => {
  it('starts with English, and every entry says its own name and direction', () => {
    expect(LOCALES[0].code).toBe('en')
    for (const l of LOCALES) {
      expect(l.name.length).toBeGreaterThan(0)
      expect(['ltr', 'rtl']).toContain(l.dir)
    }
  })
  it('has a right-to-left test language and a long, accented one', () => {
    expect(LOCALES.find((l) => l.code === 'xb')).toMatchObject({ dir: 'rtl', test: true })
    expect(LOCALES.find((l) => l.code === 'xa')).toMatchObject({ dir: 'ltr', test: true })
  })
  it('offers the real languages to choose from, not the test ones', () => {
    expect(selectable().map((l) => l.code)).toEqual(['en', 'hi'])
  })
  it('knows its own codes', () => {
    expect(isKnown('hi')).toBe(true)
    expect(isKnown('xb')).toBe(true)
    expect(isKnown('fr')).toBe(false)
    expect(isKnown(null)).toBe(false)
  })
})

describe('pickLocale', () => {
  it('prefers the address, then the saved choice, then the browser, then English', () => {
    expect(pickLocale({ url: 'hi', stored: 'en', browser: ['en-US'] })).toBe('hi')
    expect(pickLocale({ url: null, stored: 'hi', browser: ['en-US'] })).toBe('hi')
    expect(pickLocale({ url: null, stored: null, browser: ['hi-IN', 'en'] })).toBe('hi')
    expect(pickLocale({ url: null, stored: null, browser: [] })).toBe('en')
  })
  it('skips what it does not know', () => {
    expect(pickLocale({ url: 'fr', stored: 'de', browser: ['fr-FR', 'hi'] })).toBe('hi')
    expect(pickLocale({ browser: ['fr-FR'] })).toBe('en')
  })
  it('matches a regional browser language to its language, case-insensitively', () => {
    expect(pickLocale({ browser: ['HI-in'] })).toBe('hi')
    expect(pickLocale({ browser: ['en-GB'] })).toBe('en')
  })
  it('never picks a test language from the browser, only when asked for by address or saved choice', () => {
    expect(pickLocale({ browser: ['xb', 'xa'] })).toBe('en')
    expect(pickLocale({ url: 'xb' })).toBe('xb')
    expect(pickLocale({ stored: 'xa' })).toBe('xa')
  })
})

describe('intlLocale', () => {
  it('gives the real languages their own formats and the test ones English formats', () => {
    expect(intlLocale('hi')).toBe('hi')
    expect(intlLocale('en')).toBe('en')
    expect(intlLocale('xa')).toBe('en')
    expect(intlLocale('xb')).toBe('en')
  })
})
