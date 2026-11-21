import { dayNumber } from '../engine/calendar'
import type { PlanInput, PlanResult } from '../engine'
import { t, type MessageKey } from '../i18n'
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

/** The technicians who have visits on a day, in technician order, for the buttons that make their packs and sheets. */
export function routesOfDay(input: PlanInput, result: PlanResult, day: number): { tech: number; name: string; visits: number }[] {
  return result.routes
    .filter((r) => r.day === day && r.stops.length > 0)
    .map((r) => ({ tech: r.tech, name: input.technicians[r.tech].name, visits: r.stops.length }))
}

export function serialisePack(pack: RoutePack): string {
  return JSON.stringify(pack, null, 2) + '\n'
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** An error that names the stop and says what is wrong with it. */
const badStop = (n: number, problem: MessageKey): PackError => new PackError(t('pack.err.stop', { n, problem: t(problem) }))

function readStop(raw: unknown, n: number): PackStop {
  if (typeof raw !== 'object' || raw === null) throw badStop(n, 'pack.err.stopNotStop')
  const s = raw as Record<string, unknown>
  if (!isNumber(s.visit) || !Number.isInteger(s.visit) || s.visit < 1) throw badStop(n, 'pack.err.stopVisit')
  if (!isText(s.caseId)) throw badStop(n, 'pack.err.stopCase')
  if (typeof s.workType !== 'string') throw badStop(n, 'pack.err.stopWorkType')
  if (typeof s.place !== 'string') throw badStop(n, 'pack.err.stopPlace')
  if (!isNumber(s.lat) || s.lat < -90 || s.lat > 90) throw badStop(n, 'pack.err.stopLat')
  if (!isNumber(s.lon) || s.lon < -180 || s.lon > 180) throw badStop(n, 'pack.err.stopLon')
  if (typeof s.arrival !== 'string' || !/^\d{2}:\d{2}$/.test(s.arrival)) throw badStop(n, 'pack.err.stopArrival')
  if (!isNumber(s.kilometres) || s.kilometres < 0) throw badStop(n, 'pack.err.stopKm')
  if (!isNumber(s.drivingMinutes) || s.drivingMinutes < 0) throw badStop(n, 'pack.err.stopMin')
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
    throw new PackError(t('pack.err.notPack'))
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw) || !('packVersion' in raw)) throw new PackError(t('pack.err.notPack'))
  const p = raw as Record<string, unknown>
  if (p.packVersion !== 1) throw new PackError(t('pack.err.version'))
  if (!isText(p.technician)) throw new PackError(t('pack.err.technician'))
  if (typeof p.site !== 'string') throw new PackError(t('pack.err.site'))
  if (typeof p.date !== 'string' || !ISO_DATE.test(p.date)) throw new PackError(t('pack.err.date'))
  if (typeof p.validFor !== 'string' || !ISO_DATE.test(p.validFor)) throw new PackError(t('pack.err.validFor'))
  if (typeof p.createdAt !== 'string' || Number.isNaN(Date.parse(p.createdAt))) throw new PackError(t('pack.err.createdAt'))
  if (!Array.isArray(p.stops) || p.stops.length === 0) throw new PackError(t('pack.err.noStops'))
  const stops = p.stops.map((s, i) => readStop(s, i + 1))
  if (new Set(stops.map((s) => s.visit)).size !== stops.length) throw new PackError(t('pack.err.duplicate'))
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
