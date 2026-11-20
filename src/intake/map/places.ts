import type { SitePlace, SiteProfile } from '../site/site'
import { normaliseName } from './model'

export interface Location {
  latitude?: number
  longitude?: number
  postalCode?: string
  area?: string
  address?: string
}

export interface Resolved {
  /** Name of the place in the site's table, or of a place created from coordinates. Null when nothing matched. */
  place: string | null
  /** Set when this call created a new place (the caller adds it to the site). */
  created: SitePlace | null
}

const validPair = (lat: number | undefined, lon: number | undefined): lat is number =>
  lat !== undefined && lon !== undefined && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180

const pairKey = (lat: number, lon: number): string => `${lat.toFixed(5)},${lon.toFixed(5)}`

/**
 * Finds the place of a location without any lookup over the internet. Order: coordinates (one place per distinct pair,
 * rounded to 5 decimals), the area name, an alias of it, the postal code, the address text. `created` collects places
 * made from coordinates, so the same pair gives the same place. The site is not changed.
 */
export function resolveLocation(loc: Location, site: SiteProfile, created: Map<string, SitePlace>): Resolved {
  const byName = new Map(site.places.map((p) => [normaliseName(p.name), p]))
  const byCoords = new Map(site.places.map((p) => [pairKey(p.latitude, p.longitude), p]))
  const byPostal = new Map<string, SitePlace>()
  for (const p of site.places) if (p.postalCode !== undefined) byPostal.set(normaliseName(p.postalCode), p)
  const named = (text: string | undefined): SitePlace | undefined => {
    if (text === undefined) return undefined
    const key = normaliseName(text)
    if (key === '') return undefined
    const direct = byName.get(key)
    if (direct !== undefined) return direct
    const alias = Object.entries(site.aliases).find(([k]) => normaliseName(k) === key)?.[1]
    return alias === undefined ? undefined : byName.get(normaliseName(alias))
  }

  if (validPair(loc.latitude, loc.longitude)) {
    const key = pairKey(loc.latitude, loc.longitude as number)
    const known = byCoords.get(key) ?? created.get(key)
    if (known !== undefined) return { place: known.name, created: null }
    const nameText = loc.area?.trim()
    const place: SitePlace = {
      name: nameText !== undefined && nameText !== '' ? nameText : key,
      latitude: loc.latitude,
      longitude: loc.longitude as number,
      ...(loc.postalCode !== undefined && loc.postalCode.trim() !== '' ? { postalCode: loc.postalCode.trim() } : {}),
    }
    created.set(key, place)
    return { place: place.name, created: place }
  }
  const byArea = named(loc.area)
  if (byArea !== undefined) return { place: byArea.name, created: null }
  if (loc.postalCode !== undefined) {
    const p = byPostal.get(normaliseName(loc.postalCode))
    if (p !== undefined) return { place: p.name, created: null }
  }
  const byAddress = named(loc.address)
  if (byAddress !== undefined) return { place: byAddress.name, created: null }
  return { place: null, created: null }
}
