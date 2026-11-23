import { describe, expect, it } from 'vitest'
import { mapsKind, mapsLink } from './mapsLink'

describe('mapsLink on Android: one tap on a stop opens the phone\'s maps app with a pin on it (FR-28.9)', () => {
  it('puts the coordinates in the path and in the query, with the label, so a pin is dropped', () => {
    expect(mapsLink(20.02883, 29.97967, 'Stop 1: case 100248', 'android')).toBe('geo:20.02883,29.97967?q=20.02883,29.97967(Stop%201%3A%20case%20100248)')
  })
  it('keeps the sign of a coordinate and does not turn a whole number into text', () => {
    expect(mapsLink(-12.5, 77, 'A', 'android')).toBe('geo:-12.5,77?q=-12.5,77(A)')
  })
  it('writes a label in any language so that it survives the address', () => {
    const link = mapsLink(1, 2, 'स्टॉप 1', 'android')
    expect(link).toMatch(/^geo:1,2\?q=1,2\(.+\)$/)
    expect(decodeURIComponent(link.slice(link.indexOf('(') + 1, -1))).toBe('स्टॉप 1')
  })
  it('leaves brackets out of the label, which would end it early', () => {
    const link = mapsLink(1, 2, 'Stop (1)', 'android')
    expect(link.match(/\(/g)).toHaveLength(1)
    expect(link.match(/\)/g)).toHaveLength(1)
    expect(decodeURIComponent(link)).toContain('(Stop 1)')
  })
  it('has no label at all when the label is empty: a plain pin', () => {
    expect(mapsLink(1, 2, '', 'android')).toBe('geo:1,2?q=1,2')
  })
})

describe('mapsLink anywhere else (a computer, an iPhone): a web link, because nothing opens a geo: link there', () => {
  it('is the documented Google Maps link for a pin at the coordinates', () => {
    expect(mapsLink(20.02883, 29.97967, 'Stop 1: case 100248', 'web')).toBe('https://www.google.com/maps/search/?api=1&query=20.02883,29.97967')
  })
  it('keeps the sign of a coordinate and does not turn a whole number into text', () => {
    expect(mapsLink(-12.5, 77, 'A', 'web')).toBe('https://www.google.com/maps/search/?api=1&query=-12.5,77')
  })
  it('never carries the label: the case number is not sent to a map service', () => {
    const link = mapsLink(1, 2, 'Stop 1: case 100248', 'web')
    expect(link).not.toContain('100248')
    expect(decodeURIComponent(link)).not.toContain('Stop')
  })
  it('is not a geo: link', () => {
    expect(mapsLink(1, 2, 'x', 'web').startsWith('geo:')).toBe(false)
    expect(mapsLink(1, 2, 'x', 'web').startsWith('https://')).toBe(true)
  })
})

describe('mapsKind', () => {
  const chromeAndroid = 'Mozilla/5.0 (Linux; Android 14; I2217) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36'
  const samsung = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36'
  const firefoxAndroid = 'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0'
  const chromeWindows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.8078.100 Safari/537.36'
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
  const chromeOs = 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36'

  it('says android for the browsers of an Android phone', () => {
    for (const ua of [chromeAndroid, samsung, firefoxAndroid]) expect(mapsKind(ua)).toBe('android')
  })
  it('says web for a Windows or Mac computer, an iPhone and a Chromebook', () => {
    for (const ua of [chromeWindows, iphone, mac, chromeOs]) expect(mapsKind(ua)).toBe('web')
  })
  it('says web when there is nothing to go by', () => {
    expect(mapsKind('')).toBe('web')
  })
})
