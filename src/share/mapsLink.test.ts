import { describe, expect, it } from 'vitest'
import { mapsLink } from './mapsLink'

describe('mapsLink: one tap on a stop opens the phone\'s maps app with a pin on it (FR-28.9)', () => {
  it('puts the coordinates in the path and in the query, with the label, so a pin is dropped', () => {
    expect(mapsLink(20.02883, 29.97967, 'Stop 1: case 100248')).toBe('geo:20.02883,29.97967?q=20.02883,29.97967(Stop%201%3A%20case%20100248)')
  })
  it('keeps the sign of a coordinate and does not turn a whole number into text', () => {
    expect(mapsLink(-12.5, 77, 'A')).toBe('geo:-12.5,77?q=-12.5,77(A)')
  })
  it('writes a label in any language so that it survives the address', () => {
    const link = mapsLink(1, 2, 'स्टॉप 1')
    expect(link).toMatch(/^geo:1,2\?q=1,2\(.+\)$/)
    expect(decodeURIComponent(link.slice(link.indexOf('(') + 1, -1))).toBe('स्टॉप 1')
  })
  it('leaves brackets out of the label, which would end it early', () => {
    const link = mapsLink(1, 2, 'Stop (1)')
    expect(link.match(/\(/g)).toHaveLength(1)
    expect(link.match(/\)/g)).toHaveLength(1)
    expect(decodeURIComponent(link)).toContain('(Stop 1)')
  })
  it('has no label at all when the label is empty: a plain pin', () => {
    expect(mapsLink(1, 2, '')).toBe('geo:1,2?q=1,2')
  })
})
