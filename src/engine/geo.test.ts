import { describe, expect, it } from 'vitest'
import { buildGeo, haversineKm, snapMinutes } from './geo'
import { testSettings } from './testing/fixtures'

describe('snapMinutes (rounds travel times to 9 decimals so that every device sees the same numbers)', () => {
  it.each([
    [0, 0],
    [5, 5],
    [1.0000000004, 1],
    [1.0000000006, 1.000000001],
    [30.0226324900004, 30.02263249],
    [12.3456789014999, 12.345678901],
    [12.3456789015001, 12.345678902],
  ])('snapMinutes(%f) = %f', (x, want) => {
    expect(snapMinutes(x)).toBe(want)
  })
  it('is idempotent', () => {
    for (const x of [0.5, 17.123456789012, 99.999999999999, 1234.5678901234]) {
      expect(snapMinutes(snapMinutes(x))).toBe(snapMinutes(x))
    }
  })
})

describe('haversineKm', () => {
  it('is 0 for the same point', () => {
    expect(haversineKm(20, 30, 20, 30)).toBe(0)
  })
  it('is one degree of arc along the equator: 6371 km times pi/180', () => {
    expect(haversineKm(0, 0, 0, 1)).toBeCloseTo(111.19492664455873, 8)
  })
  it('is symmetric', () => {
    expect(haversineKm(20, 30, 20.3, 30.4)).toBeCloseTo(haversineKm(20.3, 30.4, 20, 30), 12)
  })
})

describe('buildGeo travel times', () => {
  const s = testSettings()
  const places = [
    { name: 'North', lat: 20.1, lon: 30 },
    { name: 'Twin', lat: 20.1, lon: 30 },
    { name: 'Near', lat: 20.1000001, lon: 30 },
  ]
  const g = buildGeo(s, places)

  it('has a node for the base and one per place', () => {
    expect(g.tm.length).toBe(4)
    expect(g.tm[0].length).toBe(4)
  })
  it('is 0 at the base and the same-area hop inside a place', () => {
    expect(g.tm[0][0]).toBe(0)
    expect(g.tm[1][1]).toBe(10)
  })
  it('uses distance x road factor / speed x 60 for different points, snapped to 9 decimals', () => {
    const km = haversineKm(20, 30, 20.1, 30)
    expect(g.tm[0][1]).toBe(snapMinutes(((km * 1.35) / 30) * 60))
    expect(g.tm[0][1]).toBeCloseTo((km * 1.35) / 30 * 60, 8)
  })
  it('never goes below half the same-area hop', () => {
    expect(g.tm[1][2]).toBe(5) // two places at the same spot
    expect(g.tm[1][3]).toBe(5) // two places a few centimetres apart
  })
})

describe('buildGeo zones and distances', () => {
  const s = testSettings()
  const places = [
    { name: 'N', lat: 20.1, lon: 30 },
    { name: 'E', lat: 20, lon: 30.1 },
    { name: 'S', lat: 19.9, lon: 30 },
    { name: 'W', lat: 20, lon: 29.9 },
    { name: 'NE', lat: 20.1, lon: 30.1 },
    { name: 'Centre', lat: 20.01, lon: 30 },
  ]
  const g = buildGeo(s, places)
  it('names the compass octant from the base', () => {
    expect(g.zone).toEqual(['North', 'East', 'South', 'West', 'North-East', 'Central'])
  })
  it('keeps the straight-line distance from the base', () => {
    expect(g.areaKm[0]).toBeCloseTo(11.119492664455873, 6)
    expect(g.areaKm[5]).toBeLessThan(4)
  })
})
