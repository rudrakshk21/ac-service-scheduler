/** A point in screen pixels. */
export interface Pt {
  x: number
  y: number
}

/** The rectangle markers are kept inside, in screen pixels. */
export interface Frame {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Points nearer than this are treated as one spot. */
const SAME_SPOT = 1
/** Spreading stops once nothing overlaps by more than this. */
const GOOD_ENOUGH = 0.25
const MAX_PASSES = 40
/** A map with more markers than this is a crowd whatever is done (and is redrawn on every zoom), so it gets a few passes only. */
const CROWD = 1000
const CROWD_PASSES = 10
const GOLDEN_ANGLE = 2.399963229728653

/** Which cell of a grid a point is in, as one number (cells are `size` wide). */
const cellKey = (cx: number, cy: number): number => (cx + 50_000) * 100_003 + (cy + 50_000)

/** Moves a point back toward where it started when it has gone further than `limit`. */
function holdNear(p: Pt, home: Pt, limit: number): void {
  const d = Math.hypot(p.x - home.x, p.y - home.y)
  if (d > limit) {
    p.x = home.x + ((p.x - home.x) / d) * limit
    p.y = home.y + ((p.y - home.y) / d) * limit
  }
}

/**
 * Moves markers apart so that none sits on another. Stops that share a place are on one spot on the map, so the markers
 * lie exactly on top of each other and only the last drawn can be seen or tapped.
 *
 * Markers on one spot are laid on a ring around it, the first on the left and the rest clockwise, so a route's stops
 * (which are listed in order) read in order. Markers that are near but not on one spot are then pushed apart, a little at
 * a time, until they are `minDist` apart. No marker is moved further than `maxShift` from where it really is, so a crowd
 * that cannot be separated (too many in too little room) stays as it was, as near its true places as possible, and the
 * person can zoom in. Markers that were already apart are not moved at all. Nothing random is used: the same points give
 * the same answer.
 */
export function declutter(points: Pt[], minDist: number, maxShift: number = 3 * minDist, frame?: Frame): Pt[] {
  const out = points.map((p) => ({ x: p.x, y: p.y }))
  const n = out.length
  /** Keeps a marker inside the frame. The spreading works with this, so markers at an edge are pushed the other way, not squeezed. */
  const keepIn = (p: Pt): void => {
    if (frame === undefined) return
    p.x = Math.min(Math.max(p.x, frame.x0), frame.x1)
    p.y = Math.min(Math.max(p.y, frame.y0), frame.y1)
  }
  if (n < 2 || !(minDist > 0)) {
    out.forEach(keepIn)
    return out
  }

  // 1. Markers on one spot: a ring around the spot.
  const cell = SAME_SPOT
  const grid = new Map<number, number[]>()
  const parent = Array.from({ length: n }, (_, i) => i)
  const root = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  for (let i = 0; i < n; i++) {
    const cx = Math.floor(out[i].x / cell)
    const cy = Math.floor(out[i].y / cell)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(cellKey(cx + dx, cy + dy)) ?? []) {
          if (Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y) < SAME_SPOT) parent[root(i)] = root(j)
        }
      }
    }
    const key = cellKey(cx, cy)
    grid.set(key, [...(grid.get(key) ?? []), i])
  }
  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) groups.set(root(i), [...(groups.get(root(i)) ?? []), i])
  for (const members of groups.values()) {
    const k = members.length
    if (k < 2) continue
    const cx = members.reduce((s, i) => s + points[i].x, 0) / k
    const cy = members.reduce((s, i) => s + points[i].y, 0) / k
    const radius = Math.min(minDist / (2 * Math.sin(Math.PI / k)), maxShift)
    members.forEach((i, m) => {
      const angle = Math.PI + (2 * Math.PI * m) / k
      out[i] = { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
      holdNear(out[i], points[i], maxShift)
      keepIn(out[i])
    })
  }
  // Markers on their own are kept inside the frame too (a marker the planner puts on the edge is drawn half outside).
  out.forEach(keepIn)

  // 2. Markers that are near each other but not on one spot: push apart, a little at a time.
  const passes = n > CROWD ? CROWD_PASSES : MAX_PASSES
  for (let pass = 0; pass < passes; pass++) {
    const cells = new Map<number, number[]>()
    for (let i = 0; i < n; i++) {
      const key = cellKey(Math.floor(out[i].x / minDist), Math.floor(out[i].y / minDist))
      const list = cells.get(key)
      if (list === undefined) cells.set(key, [i])
      else list.push(i)
    }
    const mx = new Float64Array(n)
    const my = new Float64Array(n)
    let worst = 0
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(out[i].x / minDist)
      const cy = Math.floor(out[i].y / minDist)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const j of cells.get(cellKey(cx + dx, cy + dy)) ?? []) {
            if (j <= i) continue
            let vx = out[j].x - out[i].x
            let vy = out[j].y - out[i].y
            let d = Math.hypot(vx, vy)
            if (d >= minDist) continue
            if (d < 1e-6) {
              vx = Math.cos(i * GOLDEN_ANGLE)
              vy = Math.sin(i * GOLDEN_ANGLE)
              d = 1
            }
            const overlap = minDist - Math.hypot(out[j].x - out[i].x, out[j].y - out[i].y)
            worst = Math.max(worst, overlap)
            const push = overlap / 2
            mx[i] -= (vx / d) * push
            my[i] -= (vy / d) * push
            mx[j] += (vx / d) * push
            my[j] += (vy / d) * push
          }
        }
      }
    }
    if (worst < GOOD_ENOUGH) break
    for (let i = 0; i < n; i++) {
      out[i].x += mx[i] * 0.8
      out[i].y += my[i] * 0.8
      holdNear(out[i], points[i], maxShift)
      keepIn(out[i])
    }
  }
  return out
}
