import { describe, expect, it } from 'vitest'
import { placeholders } from './core'
import en from './en.json'
import { LOCALES } from './locales'

const english = en as Record<string, string>
// Every messages file next to en.json, found by name, so a new language is checked without editing this test.
const found = import.meta.glob<Record<string, string>>('./*.json', { eager: true, import: 'default' })
const languages: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(found)
    .map(([path, messages]) => [path.replace(/^\.\/|\.json$/g, ''), messages] as const)
    .filter(([code]) => code !== 'en' && code !== 'languages'),
)

describe('every language has what English has', () => {
  for (const [code, messages] of Object.entries(languages)) {
    it(`${code}: no key is missing and none is extra`, () => {
      const missing = Object.keys(english).filter((k) => !(k in messages))
      const extra = Object.keys(messages).filter((k) => !(k in english))
      expect({ missing, extra }).toEqual({ missing: [], extra: [] })
    })

    it(`${code}: every message fills the same placeholders as the English one`, () => {
      const wrong = Object.keys(messages).filter((k) => k in english && placeholders(messages[k]).join() !== placeholders(english[k]).join())
      expect(wrong).toEqual([])
    })

    it(`${code}: no message is empty`, () => {
      expect(Object.entries(messages).filter(([, text]) => text.trim() === '').map(([k]) => k)).toEqual([])
    })
  }

  it('every real language in the list has its messages checked here', () => {
    const real = LOCALES.filter((l) => l.test !== true && l.code !== 'en').map((l) => l.code)
    expect(real.sort()).toEqual(Object.keys(languages).sort())
  })
})

describe('the English messages', () => {
  it('give every plural a form for "other", which every language falls back to', () => {
    const bases = new Set(Object.keys(english).filter((k) => /\.(zero|one|two|few|many)$/.test(k)).map((k) => k.replace(/\.[a-z]+$/, '')))
    const lacking = [...bases].filter((b) => !(`${b}.other` in english))
    expect(lacking).toEqual([])
  })

  it('have the keys that are built from a code at run time (states, issues, fields, weekdays, kinds, tables)', () => {
    const needed = [
      ...['active', 'hold', 'review', 'ignored', 'done', 'closed'].map((s) => `state.${s}`),
      ...['missing_id', 'no_location', 'unknown_work_type', 'bad_date', 'duplicate_id'].map((s) => `import.issue.${s}`),
      ...['cases', 'technicians', 'places'].flatMap((k) => [`kind.${k}`, `import.fact.toImport.${k}`, `import.detail.${k}`, `import.summary.${k}.one`, `import.summary.${k}.other`, `import.run.${k}.one`, `import.run.${k}.other`]),
      ...[0, 1, 2, 3, 4, 5, 6].map((d) => `weekday.${d}`),
    ]
    expect(needed.filter((k) => !(k in english))).toEqual([])
  })
})
