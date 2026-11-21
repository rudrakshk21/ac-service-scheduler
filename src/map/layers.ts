import type { PlanInput, PlanResult } from '../engine'
import type { RoutePack } from '../share/routePack'
import type { LatLon } from './project'

/** Technician colours are taken from a palette of this many, by the technician's place in the list. */
export const PALETTE_SIZE = 8

export interface MapStop extends LatLon {
  visit: number
  caseId: string
  /** `HH:MM`. */
  arrival: string
  place: string
}

/** One technician's route on a day: where it goes, in order, and how it is labelled and coloured. */
export interface MapLayer {
  key: string
  name: string
  /** A short label that differs from every other label on the map, so a route is never told apart by colour alone. */
  label: string
  /** Index into the palette. */
  colour: number
  stops: MapStop[]
  /** The line to draw: start, every stop in order, end. */
  path: LatLon[]
}

export interface MapData {
  /** The base of the centre, or null when it is not known (a route pack does not carry it). */
  base: LatLon | null
  layers: MapLayer[]
}

/**
 * Short, different labels for names: the first letter, lengthened for those that would be alike ("As" and "An"), and
 * numbered when the names are the same. A name without letters is labelled by its place in the list.
 */
export function labelsFor(names: string[]): string[] {
  const clean = names.map((n) => n.replace(/[^\p{L}\p{N}]/gu, ''))
  const length = clean.map(() => 1)
  const label = (i: number): string => (clean[i] === '' ? String(i + 1) : clean[i].slice(0, length[i]).replace(/^./u, (c) => c.toLocaleUpperCase()))
  for (let guard = 0; guard < 64; guard++) {
    const labels = clean.map((_, i) => label(i).toLocaleLowerCase())
    let grew = false
    for (let i = 0; i < clean.length; i++) {
      const clash = labels.some((l, j) => j !== i && l === labels[i])
      if (clash && length[i] < clean[i].length) {
        length[i] += 1
        grew = true
      }
    }
    if (!grew) break
  }
  const out = clean.map((_, i) => label(i))
  const seen = new Map<string, number>()
  return out.map((l) => {
    if (out.filter((x) => x.toLocaleLowerCase() === l.toLocaleLowerCase()).length === 1) return l
    const n = (seen.get(l) ?? 0) + 1
    seen.set(l, n)
    return `${l}${n}`
  })
}

/** The routes of every technician who has visits on `day`: stops in visit order, a line from start to end. */
export function dayLayers(input: PlanInput, result: PlanResult, day: number): MapData {
  const base: LatLon = { lat: input.settings.baseLat, lon: input.settings.baseLon }
  const caseById = new Map(input.cases.map((c) => [c.id, c]))
  const techs = [...new Set(result.scheduled.filter((s) => s.day === day).map((s) => s.tech))].sort((a, b) => a - b)
  const labels = labelsFor(techs.map((t) => input.technicians[t].name))
  const spot = (index: number | undefined): LatLon => (index === undefined ? base : { lat: input.places[index].lat, lon: input.places[index].lon })

  const layers = techs.map((t, i): MapLayer => {
    const tech = input.technicians[t]
    const stops = result.scheduled
      .filter((s) => s.tech === t && s.day === day)
      .sort((a, b) => a.visit - b.visit)
      .map((s): MapStop => {
        const c = caseById.get(s.id)
        const place = c === undefined ? undefined : input.places[c.place]
        return { visit: s.visit, caseId: s.id, arrival: s.eta, place: place?.name ?? '', lat: place?.lat ?? base.lat, lon: place?.lon ?? base.lon }
      })
    return {
      key: String(t),
      name: tech.name,
      label: labels[i],
      colour: t % PALETTE_SIZE,
      stops,
      path: [spot(tech.startPlace), ...stops.map((s) => ({ lat: s.lat, lon: s.lon })), spot(tech.endPlace)],
    }
  })
  return { base, layers }
}

/** The stops of a route pack as one route. A pack does not say where the day starts, so there is no base and the line only joins the stops. */
export function packLayers(pack: RoutePack): MapData {
  const stops = pack.stops.map((s): MapStop => ({ visit: s.visit, caseId: s.caseId, arrival: s.arrival, place: s.place, lat: s.lat, lon: s.lon }))
  return {
    base: null,
    layers: [{ key: pack.technician, name: pack.technician, label: labelsFor([pack.technician])[0], colour: 0, stops, path: stops.map((s) => ({ lat: s.lat, lon: s.lon })) }],
  }
}
