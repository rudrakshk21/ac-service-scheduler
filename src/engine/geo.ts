import { pyMod, pyRound } from './pymath'
import type { Place, Settings } from './types'

export function haversineKm(la1: number, lo1: number, la2: number, lo2: number): number {
  const r = 6371.0
  const p = Math.PI / 180.0
  const dLa = (la2 - la1) * p
  const dLo = (lo2 - lo1) * p
  const sa = Math.sin(dLa / 2)
  const so = Math.sin(dLo / 2)
  const a = sa * sa + Math.cos(la1 * p) * Math.cos(la2 * p) * (so * so)
  return 2 * r * Math.asin(Math.sqrt(a))
}

export interface Geo {
  /** Travel minutes between nodes. Node 0 is the base; node i + 1 is places[i]. */
  tm: number[][]
  /** Compass zone of each place, as seen from the base. */
  zone: string[]
  /** Straight-line kilometres from the base to each place. */
  areaKm: number[]
}

const OCTANTS = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West']
// Python's math.degrees multiplies by a precomputed 180 / pi.
const RAD_TO_DEG = 180.0 / Math.PI

export function buildGeo(s: Settings, places: Place[]): Geo {
  const n = places.length + 1
  const la = [s.baseLat, ...places.map((p) => p.lat)]
  const lo = [s.baseLon, ...places.map((p) => p.lon)]
  const tm: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        tm[i][j] = i === 0 ? 0.0 : s.sameAreaHopMin
      } else {
        tm[i][j] = Math.max(
          s.sameAreaHopMin * 0.5,
          ((haversineKm(la[i], lo[i], la[j], lo[j]) * s.roadFactor) / s.speedKmh) * 60.0,
        )
      }
    }
  }
  const zone: string[] = []
  const areaKm: number[] = []
  for (let i = 0; i < places.length; i++) {
    const km = haversineKm(la[0], lo[0], la[i + 1], lo[i + 1])
    const dy = la[i + 1] - la[0]
    const dx = (lo[i + 1] - lo[0]) * Math.cos((la[0] * Math.PI) / 180.0)
    let ang = Math.atan2(dx, dy) * RAD_TO_DEG
    if (ang < 0) ang += 360
    areaKm.push(km)
    zone.push(km < 4 ? 'Central' : OCTANTS[pyMod(pyRound(ang / 45.0), 8)])
  }
  return { tm, zone, areaKm }
}
