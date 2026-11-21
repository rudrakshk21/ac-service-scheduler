import { describe, expect, it } from 'vitest'
import { fitProjection, fullView, MAX_ZOOM, panView, scaleBar, zoomOf, zoomView } from './project'

const W = 720
const H = 480
const PAD = 40

describe('fitProjection', () => {
  const points = [{ lat: 12.9, lon: 77.5 }, { lat: 13.1, lon: 77.7 }, { lat: 13.0, lon: 77.6 }]

  it('puts every point inside the frame, with the padding kept free', () => {
    const p = fitProjection(points, W, H, PAD)
    for (const pt of points) {
      const { x, y } = p.project(pt)
      expect(x).toBeGreaterThanOrEqual(PAD - 0.001)
      expect(x).toBeLessThanOrEqual(W - PAD + 0.001)
      expect(y).toBeGreaterThanOrEqual(PAD - 0.001)
      expect(y).toBeLessThanOrEqual(H - PAD + 0.001)
    }
  })

  it('has north at the top and east on the right', () => {
    const p = fitProjection(points, W, H, PAD)
    expect(p.project({ lat: 13.1, lon: 77.6 }).y).toBeLessThan(p.project({ lat: 12.9, lon: 77.6 }).y)
    expect(p.project({ lat: 13.0, lon: 77.7 }).x).toBeGreaterThan(p.project({ lat: 13.0, lon: 77.5 }).x)
  })

  it('keeps distances true: a degree of longitude is shorter than a degree of latitude away from the equator', () => {
    const north = [{ lat: 60, lon: 10 }, { lat: 61, lon: 10 }, { lat: 60, lon: 11 }]
    const p = fitProjection(north, W, H, PAD)
    const a = p.project(north[0])
    const up = p.project(north[1])
    const right = p.project(north[2])
    const dy = Math.abs(up.y - a.y)
    const dx = Math.abs(right.x - a.x)
    expect(dx / dy).toBeCloseTo(Math.cos((60.5 * Math.PI) / 180), 5) // the middle latitude of the points is 60.5 degrees
  })

  it('reports how many kilometres a pixel is', () => {
    const p = fitProjection([{ lat: 0, lon: 0 }, { lat: 1, lon: 0 }], W, H, PAD)
    const a = p.project({ lat: 0, lon: 0 })
    const b = p.project({ lat: 1, lon: 0 })
    expect(Math.abs(b.y - a.y) * p.kmPerPx).toBeCloseTo(111.32, 1)
  })

  it('centres a single point, and does not blow up', () => {
    const p = fitProjection([{ lat: 12.9, lon: 77.5 }], W, H, PAD)
    const { x, y } = p.project({ lat: 12.9, lon: 77.5 })
    expect(x).toBeCloseTo(W / 2, 3)
    expect(y).toBeCloseTo(H / 2, 3)
    expect(Number.isFinite(p.kmPerPx)).toBe(true)
  })

  it('treats points that are all the same like a single point', () => {
    const p = fitProjection([{ lat: 1, lon: 2 }, { lat: 1, lon: 2 }], W, H, PAD)
    expect(p.project({ lat: 1, lon: 2 })).toEqual({ x: W / 2, y: H / 2 })
  })

  it('gives a usable projection for no points at all', () => {
    const p = fitProjection([], W, H, PAD)
    expect(p.project({ lat: 5, lon: 5 })).toEqual({ x: W / 2, y: H / 2 })
  })

  it('uses the whole frame for the longer side, so a wide spread fills the width', () => {
    const wide = [{ lat: 13, lon: 77.0 }, { lat: 13, lon: 78.0 }]
    const p = fitProjection(wide, W, H, PAD)
    const xs = wide.map((w) => p.project(w).x)
    expect(Math.min(...xs)).toBeCloseTo(PAD, 3)
    expect(Math.max(...xs)).toBeCloseTo(W - PAD, 3)
  })
})

describe('scaleBar', () => {
  it('picks the longest round length that fits, and says it in plain units', () => {
    expect(scaleBar(0.05, 120)).toEqual({ km: 5, px: expect.closeTo(100, 6), label: '5 km' })
    expect(scaleBar(0.1, 120)).toEqual({ km: 10, px: expect.closeTo(100, 6), label: '10 km' })
    expect(scaleBar(0.3, 150)).toEqual({ km: 20, px: expect.closeTo(66.667, 2), label: '20 km' })
  })
  it('uses metres below one kilometre', () => {
    expect(scaleBar(0.002, 120)).toMatchObject({ km: 0.2, label: '200 m' })
    expect(scaleBar(0.0005, 120)).toMatchObject({ km: 0.05, label: '50 m' })
  })
  it('never gives a bar longer than the room it was offered', () => {
    for (const k of [0.001, 0.013, 0.2, 1, 7.5, 40]) expect(scaleBar(k, 100).px).toBeLessThanOrEqual(100)
  })
})

describe('zoom and pan', () => {
  const canvas = { w: W, h: H }

  it('starts with the whole frame, at zoom 1', () => {
    expect(fullView(W, H)).toEqual({ x: 0, y: 0, w: W, h: H })
    expect(zoomOf(fullView(W, H), canvas)).toBe(1)
  })
  it('zooms in towards the centre', () => {
    const v = zoomView(fullView(W, H), canvas, 2)
    expect(v).toEqual({ x: W / 4, y: H / 4, w: W / 2, h: H / 2 })
    expect(zoomOf(v, canvas)).toBe(2)
  })
  it('keeps the point it zooms around where it was on screen', () => {
    const around = { x: 100, y: 100 }
    const v = zoomView(fullView(W, H), canvas, 2, around)
    expect((around.x - v.x) / v.w).toBeCloseTo(100 / W, 6)
    expect((around.y - v.y) / v.h).toBeCloseTo(100 / H, 6)
  })
  it('stops at the largest zoom and never zooms out past the whole frame', () => {
    expect(zoomOf(zoomView(fullView(W, H), canvas, 100), canvas)).toBe(MAX_ZOOM)
    expect(zoomView(fullView(W, H), canvas, 0.25)).toEqual(fullView(W, H))
  })
  it('zooms back out to the whole frame', () => {
    const v = zoomView(zoomView(fullView(W, H), canvas, 4), canvas, 1 / 4)
    expect(v).toEqual(fullView(W, H))
  })
  it('pans, and stays inside the frame', () => {
    const zoomed = zoomView(fullView(W, H), canvas, 2)
    expect(panView(zoomed, canvas, 10, -10)).toEqual({ ...zoomed, x: zoomed.x + 10, y: zoomed.y - 10 })
    expect(panView(zoomed, canvas, -9999, -9999)).toEqual({ ...zoomed, x: 0, y: 0 })
    expect(panView(zoomed, canvas, 9999, 9999)).toEqual({ ...zoomed, x: W - zoomed.w, y: H - zoomed.h })
  })
  it('cannot pan when the whole frame is showing', () => {
    expect(panView(fullView(W, H), canvas, 50, 50)).toEqual(fullView(W, H))
  })
})
