import { describe, expect, it } from 'vitest'
import type { SitePlace, SiteProfile } from '../site/site'
import { starterSite } from '../site/starter'
import { resolveLocation } from './places'

const site: SiteProfile = {
  ...starterSite(),
  places: [
    { name: 'North Town', latitude: 20.1, longitude: 30.05, postalCode: '111111' },
    { name: 'South Bay', latitude: 19.95, longitude: 30.1, postalCode: '222222' },
  ],
  aliases: { 'n town': 'North Town' },
}
const fresh = () => new Map<string, SitePlace>()

describe('resolveLocation', () => {
  it('finds a place whose coordinates equal the given pair (5 decimals) and creates nothing', () => {
    expect(resolveLocation({ latitude: 20.1, longitude: 30.05 }, site, fresh())).toEqual({ place: 'North Town', created: null })
    expect(resolveLocation({ latitude: 20.100001, longitude: 30.050004 }, site, fresh()).place).toBe('North Town')
  })
  it('creates one place per new pair, named after the area text or the coordinates, and reuses it', () => {
    const created = fresh()
    const a = resolveLocation({ latitude: 19.12345, longitude: 30.54321, area: ' Hill Road ' }, site, created)
    expect(a.place).toBe('Hill Road')
    expect(a.created).toEqual({ name: 'Hill Road', latitude: 19.12345, longitude: 30.54321 })
    const again = resolveLocation({ latitude: 19.12345, longitude: 30.54321 }, site, created)
    expect(again).toEqual({ place: 'Hill Road', created: null })
    const bare = resolveLocation({ latitude: 18.5, longitude: 30.5 }, site, created)
    expect(bare.place).toBe('18.50000,30.50000')
    expect(created.size).toBe(2)
  })
  it('keeps the postal code of a created place', () => {
    const r = resolveLocation({ latitude: 18.5, longitude: 31, postalCode: ' 333333 ' }, site, fresh())
    expect(r.created?.postalCode).toBe('333333')
  })
  it('finds a place by normalised name, through an alias, by postal code, and by address text', () => {
    expect(resolveLocation({ area: ' north  TOWN ' }, site, fresh()).place).toBe('North Town')
    expect(resolveLocation({ area: 'N Town' }, site, fresh()).place).toBe('North Town')
    expect(resolveLocation({ postalCode: '222222' }, site, fresh()).place).toBe('South Bay')
    expect(resolveLocation({ address: 'South Bay' }, site, fresh()).place).toBe('South Bay')
  })
  it('ignores incomplete or impossible coordinates and tries the next rule', () => {
    expect(resolveLocation({ latitude: 20.1, area: 'South Bay' }, site, fresh()).place).toBe('South Bay')
    expect(resolveLocation({ latitude: 95, longitude: 30, area: 'South Bay' }, site, fresh()).place).toBe('South Bay')
    expect(resolveLocation({ latitude: Number.NaN, longitude: 30, postalCode: '111111' }, site, fresh()).place).toBe('North Town')
  })
  it('follows the order: coordinates, then area, then postal code, then address', () => {
    expect(resolveLocation({ latitude: 20.1, longitude: 30.05, area: 'South Bay' }, site, fresh()).place).toBe('North Town')
    expect(resolveLocation({ area: 'South Bay', postalCode: '111111' }, site, fresh()).place).toBe('South Bay')
    expect(resolveLocation({ postalCode: '111111', address: 'South Bay' }, site, fresh()).place).toBe('North Town')
  })
  it('gives nothing when nothing matches, and does not change the site', () => {
    const frozen = JSON.stringify(site)
    expect(resolveLocation({ area: 'Nowhere', postalCode: '999999', address: '?' }, site, fresh())).toEqual({ place: null, created: null })
    expect(resolveLocation({}, site, fresh())).toEqual({ place: null, created: null })
    expect(resolveLocation({ area: '  ' }, site, fresh()).place).toBeNull()
    expect(JSON.stringify(site)).toBe(frozen)
  })
})
