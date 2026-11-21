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

/** A label has to fit in a marker beside the visit number: three letters at most. */
const MAX_LABEL_LETTERS = 3

/** A, B, … Z, AA, AB, …: the n-th spare label (from 0). */
function spareLabel(n: number): string {
  let out = ''
  for (let k = n + 1; k > 0; k = Math.floor((k - 1) / 26)) out = String.fromCharCode(65 + ((k - 1) % 26)) + out
  return out
}

/**
 * Short, different labels for names, each at most three letters and never ending in a digit (a digit would read as
 * the visit number that follows it). The first letter, lengthened for names that would be alike ("As" and "An"). Names
 * that are still alike after three letters ("Technician 01", "Technician 02") each get a spare letter, A, B, C, …,
 * which the legend explains. A name without letters is labelled by its place in the list.
 */
export function labelsFor(names: string[]): string[] {
  const letters = names.map((n) => Array.from(n.replace(/[^\p{L}]/gu, '')))
  const length = letters.map(() => 1)
  // A capital that would turn into two letters ("ß" into "SS") is left as typed, so the label keeps its length.
  const capital = (c: string): string => (Array.from(c.toLocaleUpperCase()).length === 1 ? c.toLocaleUpperCase() : c)
  const shown = (i: number): string => {
    const [first = '', ...rest] = letters[i].slice(0, length[i])
    return capital(first) + rest.join('')
  }
  const key = (label: string): string => label.toLocaleLowerCase()

  for (let grew = true; grew; ) {
    grew = false
    const labels = letters.map((_, i) => shown(i))
    for (let i = 0; i < letters.length; i++) {
      const room = length[i] < Math.min(MAX_LABEL_LETTERS, letters[i].length)
      if (room && labels.some((l, j) => j !== i && key(l) === key(labels[i]))) {
        length[i] += 1
        grew = true
      }
    }
  }

  const out = letters.map((l, i) => (l.length === 0 ? String(i + 1) : shown(i)))
  const count = new Map<string, number>()
  for (const l of out) count.set(key(l), (count.get(key(l)) ?? 0) + 1)
  const taken = new Set(count.keys())
  let next = 0
  const spare = (): string => {
    for (;;) {
      const label = spareLabel(next++)
      if (!taken.has(key(label))) return label
    }
  }
  return out.map((l) => (count.get(key(l)) === 1 ? l : spare()))
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
