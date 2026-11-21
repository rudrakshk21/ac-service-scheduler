import { describe, expect, it } from 'vitest'
import { hashFor, TABS, tabFromHash } from './nav'

describe('tabs and the URL hash', () => {
  it('reads each tab from its hash and writes it back', () => {
    for (const t of TABS) {
      expect(tabFromHash(hashFor(t.id))).toBe(t.id)
      expect(hashFor(t.id)).toBe(`#/${t.id}`)
    }
  })
  it('accepts a hash without the slash', () => {
    expect(tabFromHash('#import')).toBe('import')
  })
  it('falls back to the plan for an empty or unknown hash', () => {
    for (const h of ['', '#', '#/', '#/nope', '#/DATA', 'data']) expect(tabFromHash(h)).toBe('plan')
  })
  it('lists five tabs with plain labels', () => {
    expect(TABS.map((t) => t.label)).toEqual(['Plan', 'Data', 'Import', 'Set-up', 'Route'])
  })
})
