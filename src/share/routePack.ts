import { dayNumber } from '../engine/calendar'
import type { PlanInput, PlanResult } from '../engine'
import { isoOf } from './dates'

/**
 * A route pack is one small JSON file for one technician and one date. It is what a technician opens on an own phone,
 * read-only, with no connection. PRV-9: it holds only what is needed for the visits of that date. The app keeps no
 * customer names, and `parsePack` builds the pack again from the fields below only, so nothing else can ride along.
 */
export interface PackStop {
  visit: number
  caseId: string
  workType: string
  place: string
  lat: number
  lon: number
  /** `HH:MM`. */
  arrival: string
  /** Straight-line distance from the previous stop (or the start) times the road factor. */
  kilometres: number
  drivingMinutes: number
}

export interface RoutePack {
  packVersion: 1
  site: string
  technician: string
  /** The day of the visits, `YYYY-MM-DD`. */
  date: string
  /** When the file was made, an ISO time. A re-plan after this is not in the file. */
  createdAt: string
  /** The last day the pack is meant for, `YYYY-MM-DD`. The same as `date`. */
  validFor: string
  stops: PackStop[]
}

export class PackError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PackError'
  }
}

const one = (n: number): number => Math.round(n * 10) / 10

/** The pack for one technician on one day (`day` is a day number), from a finished plan. */
export function buildPack(site: string, input: PlanInput, result: PlanResult, tech: number, day: number, createdAt: string): RoutePack {
  const caseById = new Map(input.cases.map((c) => [c.id, c]))
  const stops = result.scheduled
    .filter((s) => s.tech === tech && s.day === day)
    .sort((a, b) => a.visit - b.visit)
    .map((s): PackStop => {
      const c = caseById.get(s.id)
      const place = c === undefined ? undefined : input.places[c.place]
      return {
        visit: s.visit,
        caseId: s.id,
        workType: c === undefined ? '' : input.workTypes[c.workType].name,
        place: place?.name ?? '',
        lat: place?.lat ?? 0,
        lon: place?.lon ?? 0,
        arrival: s.eta,
        kilometres: one(s.prevKm),
        drivingMinutes: one(s.travelMin),
      }
    })
  const date = isoOf(day)
  return { packVersion: 1, site, technician: input.technicians[tech].name, date, createdAt, validFor: date, stops }
}

export function serialisePack(pack: RoutePack): string {
  return JSON.stringify(pack, null, 2) + '\n'
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function readStop(raw: unknown, n: number): PackStop {
  const at = `Stop ${n}: `
  if (typeof raw !== 'object' || raw === null) throw new PackError(`${at}this is not a stop.`)
  const s = raw as Record<string, unknown>
  if (!isNumber(s.visit) || !Number.isInteger(s.visit) || s.visit < 1) throw new PackError(`${at}the visit number must be a whole number, 1 or more.`)
  if (!isText(s.caseId)) throw new PackError(`${at}the case number is missing.`)
  if (typeof s.workType !== 'string') throw new PackError(`${at}the work type is missing.`)
  if (typeof s.place !== 'string') throw new PackError(`${at}the place is missing.`)
  if (!isNumber(s.lat) || s.lat < -90 || s.lat > 90) throw new PackError(`${at}the latitude must be between -90 and 90.`)
  if (!isNumber(s.lon) || s.lon < -180 || s.lon > 180) throw new PackError(`${at}the longitude must be between -180 and 180.`)
  if (typeof s.arrival !== 'string' || !/^\d{2}:\d{2}$/.test(s.arrival)) throw new PackError(`${at}the arrival time is not written like 09:30.`)
  if (!isNumber(s.kilometres) || s.kilometres < 0) throw new PackError(`${at}the distance must be a number of kilometres, 0 or more.`)
  if (!isNumber(s.drivingMinutes) || s.drivingMinutes < 0) throw new PackError(`${at}the driving time must be a number of minutes, 0 or more.`)
  return {
    visit: s.visit, caseId: s.caseId, workType: s.workType, place: s.place, lat: s.lat, lon: s.lon,
    arrival: s.arrival, kilometres: s.kilometres, drivingMinutes: s.drivingMinutes,
  }
}

/** Reads a route pack. Throws a `PackError` with a plain message. Fields that are not part of a pack are dropped. */
export function parsePack(text: string): RoutePack {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new PackError('This file is not a route pack.')
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw) || !('packVersion' in raw)) throw new PackError('This file is not a route pack.')
  const p = raw as Record<string, unknown>
  if (p.packVersion !== 1) throw new PackError('This route pack was made by a different version of the app.')
  if (!isText(p.technician)) throw new PackError('The technician’s name is missing.')
  if (typeof p.site !== 'string') throw new PackError('The name of the centre is missing.')
  if (typeof p.date !== 'string' || !ISO_DATE.test(p.date)) throw new PackError('The date is not written as year-month-day.')
  if (typeof p.validFor !== 'string' || !ISO_DATE.test(p.validFor)) throw new PackError('The valid-for date is not written as year-month-day.')
  if (typeof p.createdAt !== 'string' || Number.isNaN(Date.parse(p.createdAt))) throw new PackError('The time the pack was made is not readable.')
  if (!Array.isArray(p.stops) || p.stops.length === 0) throw new PackError('This route pack has no stops.')
  const stops = p.stops.map((s, i) => readStop(s, i + 1))
  if (new Set(stops.map((s) => s.visit)).size !== stops.length) throw new PackError('Two stops have the same visit number.')
  return { packVersion: 1, site: p.site, technician: p.technician, date: p.date, createdAt: p.createdAt, validFor: p.validFor, stops }
}

/** `route-asha-k-2026-11-22.json`: letters, digits and dashes only. */
export function packFileName(pack: Pick<RoutePack, 'technician' | 'date'>): string {
  const slug = pack.technician
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `route-${slug === '' ? 'technician' : slug}-${pack.date}.json`
}

/** Whether the day the pack is meant for has gone by, and by how many days. */
export function staleness(pack: Pick<RoutePack, 'validFor'>, today: string): { past: boolean; daysAgo: number } {
  const daysAgo = dayNumber(today) - dayNumber(pack.validFor)
  return { past: daysAgo > 0, daysAgo: Math.max(0, daysAgo) }
}
