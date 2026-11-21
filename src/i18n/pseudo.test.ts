import { describe, expect, it } from 'vitest'
import { placeholders } from './core'
import { pseudoAccent, pseudoMessages, pseudoRtl } from './pseudo'

const SAMPLE = 'Import {count} cases for {name} today'

describe('pseudoAccent', () => {
  it('keeps the placeholders and changes every other ASCII letter, so untranslated text stands out', () => {
    const out = pseudoAccent(SAMPLE)
    expect(placeholders(out)).toEqual(['count', 'name'])
    const outside = out.replace(/\{\w+\}/g, '')
    expect(outside).not.toMatch(/[A-Za-z]/)
  })
  it('makes the text longer, to show where a layout has no room for a longer language', () => {
    expect(pseudoAccent(SAMPLE).length).toBeGreaterThan(SAMPLE.length + 4)
  })
  it('leaves digits, punctuation and spaces', () => {
    expect(pseudoAccent('12:30 - 5 km.')).toMatch(/^12:30 - 5 [^A-Za-z]+\.$/u)
  })
})

describe('pseudoRtl', () => {
  it('keeps the placeholders and writes everything else in a right-to-left script', () => {
    const out = pseudoRtl(SAMPLE)
    expect(placeholders(out)).toEqual(['count', 'name'])
    const outside = out.replace(/\{\w+\}/g, '')
    expect(outside).not.toMatch(/[A-Za-z]/)
    expect(outside).toMatch(/[؀-ۿ]/)
  })
  it('leaves digits alone', () => {
    expect(pseudoRtl('Step 3 of 4')).toMatch(/3.*4/)
  })
})

describe('pseudoMessages', () => {
  const en = { 'a.one': '{count} case', 'a.other': '{count} cases', b: 'Hello' }
  it('has the same keys and placeholders as the source', () => {
    for (const mode of ['accent', 'rtl'] as const) {
      const p = pseudoMessages(en, mode)
      expect(Object.keys(p)).toEqual(Object.keys(en))
      for (const k of Object.keys(en)) expect(placeholders(p[k])).toEqual(placeholders(en[k as keyof typeof en]))
    }
  })
})
