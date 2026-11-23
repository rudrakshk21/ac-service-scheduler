import { describe, expect, it } from 'vitest'
import { declutter, type Pt } from './declutter'

const D = 40
const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y)
const minPair = (ps: Pt[]): number => {
  let m = Infinity
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) m = Math.min(m, dist(ps[i], ps[j]))
  return m
}
const centroid = (ps: Pt[]): Pt => ({ x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length })
/** A seeded random number generator, so the crowded test is the same every time. */
const rng = (seed: number): (() => number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}

describe('declutter: markers that would sit on top of each other are moved apart, as little as possible', () => {
  it('leaves markers that are far enough apart exactly where they are', () => {
    const ps = [{ x: 10, y: 10 }, { x: 100, y: 10 }, { x: 10, y: 200 }, { x: 300, y: 300 }]
    expect(declutter(ps, D)).toEqual(ps)
  })
  it('gives back an empty list for no markers and the one marker for one', () => {
    expect(declutter([], D)).toEqual([])
    expect(declutter([{ x: 5, y: 6 }], D)).toEqual([{ x: 5, y: 6 }])
  })
  it('puts two markers on one spot side by side, a marker apart, around the spot', () => {
    const out = declutter([{ x: 200, y: 100 }, { x: 200, y: 100 }], D)
    expect(dist(out[0], out[1])).toBeGreaterThanOrEqual(D - 0.01)
    expect(out[0].y).toBeCloseTo(out[1].y, 6)
    const c = centroid(out)
    expect(c.x).toBeCloseTo(200, 6)
    expect(c.y).toBeCloseTo(100, 6)
  })
  it('keeps the first marker on the left, so the order of the stops reads left to right', () => {
    const out = declutter([{ x: 200, y: 100 }, { x: 200, y: 100 }], D)
    expect(out[0].x).toBeLessThan(out[1].x)
  })
  it('spreads three to twelve markers on one spot on a ring, all a marker apart, none far from the spot', () => {
    for (let k = 3; k <= 12; k++) {
      const out = declutter(Array.from({ length: k }, () => ({ x: 360, y: 240 })), D)
      expect(minPair(out)).toBeGreaterThanOrEqual(D - 0.5)
      for (const p of out) expect(dist(p, { x: 360, y: 240 })).toBeLessThanOrEqual(3 * D + 0.001)
      const c = centroid(out)
      expect(c.x).toBeCloseTo(360, 3)
      expect(c.y).toBeCloseTo(240, 3)
    }
  })
  it('treats markers less than a pixel apart as being on one spot', () => {
    const out = declutter([{ x: 100, y: 100 }, { x: 100.4, y: 100.3 }], D)
    expect(dist(out[0], out[1])).toBeGreaterThanOrEqual(D - 0.5)
  })
  it('pushes markers that are close but not equal apart until they no longer overlap', () => {
    const out = declutter([{ x: 100, y: 100 }, { x: 110, y: 100 }, { x: 120, y: 100 }], D)
    expect(minPair(out)).toBeGreaterThanOrEqual(D - 0.5)
    expect(out[0].x).toBeLessThan(out[1].x)
    expect(out[1].x).toBeLessThan(out[2].x)
  })
  it('does not move a marker that is far from a crowd', () => {
    const lone = { x: 600, y: 400 }
    const out = declutter([{ x: 100, y: 100 }, { x: 100, y: 100 }, { x: 105, y: 100 }, lone], D)
    expect(out[3]).toEqual(lone)
    expect(minPair(out.slice(0, 3))).toBeGreaterThanOrEqual(D - 0.5)
  })
  it('never moves a marker further than the limit, even when there is no room', () => {
    const out = declutter(Array.from({ length: 60 }, () => ({ x: 300, y: 300 })), D)
    for (const p of out) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
      expect(dist(p, { x: 300, y: 300 })).toBeLessThanOrEqual(3 * D + 0.001)
    }
    expect(declutter([{ x: 0, y: 0 }, { x: 0, y: 0 }], D, 10).every((p) => dist(p, { x: 0, y: 0 }) <= 10.001)).toBe(true)
  })
  it('keeps markers inside the frame and still spreads them where the frame has room', () => {
    const frame = { x0: 19, y0: 19, x1: 300, y1: 300 }
    const corner = declutter(Array.from({ length: 4 }, () => ({ x: 5, y: 5 })), D, 3 * D, frame)
    for (const p of corner) {
      expect(p.x).toBeGreaterThanOrEqual(19 - 1e-9)
      expect(p.y).toBeGreaterThanOrEqual(19 - 1e-9)
    }
    expect(minPair(corner)).toBeGreaterThanOrEqual(D - 0.5)
    const edge = declutter(Array.from({ length: 3 }, () => ({ x: 150, y: 296 })), D, 3 * D, frame)
    for (const p of edge) expect(p.y).toBeLessThanOrEqual(300 + 1e-9)
    expect(minPair(edge)).toBeGreaterThanOrEqual(D - 0.5)
  })
  it('separates a dozen stops at six shared places on a phone-sized map, against the edge of the frame (a real case)', () => {
    // Positions measured on a 288 x 192 px map: six places, two or three stops at each, several of them close together.
    const homes: [number, number][] = [[205.9, 174.2], [205.9, 174.2], [122.8, 94], [119.3, 18.3], [82.1, 34.3], [82.1, 34.3], [122.8, 94], [193.6, 59.2], [193.6, 59.2], [179.6, 105.1], [119.3, 18.3], [193.6, 59.2], [179.6, 105.1]]
    const frame = { x0: 19, y0: 19, x1: 288 - 19, y1: 192 - 19 }
    const out = declutter(homes.map(([x, y]) => ({ x, y })), D, 3 * D, frame)
    expect(minPair(out)).toBeGreaterThanOrEqual(D - 1)
    for (const p of out) {
      expect(p.x).toBeGreaterThanOrEqual(frame.x0 - 1e-9)
      expect(p.x).toBeLessThanOrEqual(frame.x1 + 1e-9)
      expect(p.y).toBeGreaterThanOrEqual(frame.y0 - 1e-9)
      expect(p.y).toBeLessThanOrEqual(frame.y1 + 1e-9)
    }
  })
  it('gives the same answer for the same input, and does not change its input', () => {
    const ps = Array.from({ length: 30 }, (_, i) => ({ x: 100 + (i % 3) * 6, y: 100 + Math.floor(i / 10) * 5 }))
    const copy = structuredClone(ps)
    const a = declutter(ps, D)
    expect(ps).toEqual(copy)
    expect(declutter(ps, D)).toEqual(a)
  })
  it('copes with a crowded map of 2,400 markers quickly, and does not make it worse', () => {
    const r = rng(7)
    const ps = Array.from({ length: 2400 }, () => ({ x: r() * 720, y: r() * 480 }))
    const overlaps = (xs: Pt[]): number => {
      let n = 0
      for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) if (dist(xs[i], xs[j]) < D) n++
      return n
    }
    const before = overlaps(ps)
    const started = performance.now()
    const out = declutter(ps, D)
    const ms = performance.now() - started
    expect(ms).toBeLessThan(1500)
    expect(overlaps(out)).toBeLessThanOrEqual(before)
    for (let i = 0; i < ps.length; i++) expect(dist(out[i], ps[i])).toBeLessThanOrEqual(3 * D + 0.001)
  })
})
