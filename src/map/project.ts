/** A place on the earth, in degrees. */
export interface LatLon {
  lat: number
  lon: number
}

export interface Projection {
  /** Where a place falls in a frame of the size the projection was made for. North is up, east is right. */
  project(p: LatLon): { x: number; y: number }
  /** How many kilometres one pixel of that frame stands for. */
  kmPerPx: number
}

const KM_PER_DEGREE = 111.32
/** A spread smaller than this (about a kilometre) is drawn as this much, so one place or a few close ones do not blow up. */
const MIN_SPAN_DEGREES = 0.01

/**
 * Fits the points into a frame, keeping distances true in both directions: a degree of longitude is drawn shorter
 * than a degree of latitude by the cosine of the middle latitude. The content is centred and the padding is kept free.
 */
export function fitProjection(points: LatLon[], width: number, height: number, padding: number): Projection {
  const room = Math.max(1, Math.min(width, height) - 2 * padding)
  if (points.length === 0) {
    return { project: () => ({ x: width / 2, y: height / 2 }), kmPerPx: KM_PER_DEGREE / (room / MIN_SPAN_DEGREES) }
  }
  const lats = points.map((p) => p.lat)
  const lons = points.map((p) => p.lon)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const lonScale = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)
  const spanX = Math.max((maxLon - minLon) * lonScale, MIN_SPAN_DEGREES)
  const spanY = Math.max(maxLat - minLat, MIN_SPAN_DEGREES)
  const scale = Math.min((width - 2 * padding) / spanX, (height - 2 * padding) / spanY)
  const midX = ((minLon + maxLon) / 2) * lonScale
  const midY = (minLat + maxLat) / 2
  return {
    project: (p) => ({ x: width / 2 + (p.lon * lonScale - midX) * scale, y: height / 2 - (p.lat - midY) * scale }),
    kmPerPx: KM_PER_DEGREE / scale,
  }
}

/** The longest round length (1, 2 or 5 times a power of ten) that fits in `maxPx`, for the scale bar. */
export function scaleBar(kmPerPx: number, maxPx: number): { km: number; px: number; label: string } {
  let best = 0
  for (let power = -3; power <= 5; power++) {
    for (const m of [1, 2, 5]) {
      const km = m * 10 ** power
      if (km / kmPerPx <= maxPx && km > best) best = km
    }
  }
  const km = best === 0 ? 0.001 : best
  return { km, px: km / kmPerPx, label: km >= 1 ? `${km} km` : `${Math.round(km * 1000)} m` }
}

/** The part of the frame that is shown: a rectangle in frame units, used as the SVG view box. */
export interface View {
  x: number
  y: number
  w: number
  h: number
}

export const MAX_ZOOM = 8

export const fullView = (w: number, h: number): View => ({ x: 0, y: 0, w, h })

/** 1 is the whole frame, 2 is half the width and height, and so on. */
export const zoomOf = (view: View, canvas: { w: number; h: number }): number => canvas.w / view.w

const keepInside = (v: View, c: { w: number; h: number }): View => ({
  ...v,
  x: Math.min(Math.max(0, v.x), c.w - v.w),
  y: Math.min(Math.max(0, v.y), c.h - v.h),
})

/** Zooms by `factor` (above 1 in, below 1 out), keeping `around` (default: the middle of the view) where it is on screen. */
export function zoomView(view: View, canvas: { w: number; h: number }, factor: number, around?: { x: number; y: number }): View {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, zoomOf(view, canvas) * factor))
  const w = canvas.w / zoom
  const h = canvas.h / zoom
  const ax = around?.x ?? view.x + view.w / 2
  const ay = around?.y ?? view.y + view.h / 2
  return keepInside({ x: ax - (ax - view.x) * (w / view.w), y: ay - (ay - view.y) * (h / view.h), w, h }, canvas)
}

/** Moves the view by (dx, dy) frame units, never out of the frame. */
export function panView(view: View, canvas: { w: number; h: number }, dx: number, dy: number): View {
  return keepInside({ ...view, x: view.x + dx, y: view.y + dy }, canvas)
}
