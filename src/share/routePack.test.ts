import { describe, expect, it } from 'vitest'
import { plan } from '../engine/index'
import type { StoredCase } from '../intake/import/merge'
import { prepare } from '../screens/plan/planData'
import { emptyWorkspace, type Workspace } from '../workspace/workspace'
import { buildPack, PackError, packFileName, parsePack, serialisePack, staleness, type RoutePack } from './routePack'

const stored = (id: string, over: Partial<StoredCase> = {}): StoredCase => ({
  caseId: id, workTypeName: 'Service', place: 'North', state: 'active', reportedAt: '2026-10-10', overrides: {},
  firstImported: '2026-10-13', lastImported: '2026-10-13', ...over,
})
function fixture() {
  const w: Workspace = emptyWorkspace()
  const ws: Workspace = {
    ...w,
    site: { ...w.site, name: 'Test centre', places: [{ name: 'North', latitude: 20.1, longitude: 30.05 }, { name: 'South', latitude: 19.95, longitude: 30.1 }] },
    technicians: [{ name: 'Asha K.', skills: ['Service'], active: true }, { name: 'Bo', skills: ['Service'], active: true }],
    cases: [stored('10'), stored('9'), stored('100', { place: 'South' }), stored('7'), stored('8', { place: 'South' })],
  }
  const p = prepare(ws, '2026-10-13')
  if (!p.ok) throw new Error(p.text)
  const result = plan(p.input)
  // The technician and day with the most stops, so tests have several to work with.
  const counts = new Map<string, number>()
  for (const s of result.scheduled) counts.set(`${s.tech}|${s.day}`, (counts.get(`${s.tech}|${s.day}`) ?? 0) + 1)
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]
  const [tech, day] = best.split('|').map(Number)
  return { input: p.input, result, tech, day }
}
const CREATED = '2026-10-13T14:05:00.000Z'

describe('buildPack', () => {
  it('holds exactly the fields PRV-9 allows, and nothing else', () => {
    const { input, result, tech, day } = fixture()
    const pack = buildPack('Test centre', input, result, tech, day, CREATED)
    expect(Object.keys(pack).sort()).toEqual(['createdAt', 'date', 'packVersion', 'site', 'stops', 'technician', 'validFor'])
    for (const stop of pack.stops) {
      expect(Object.keys(stop).sort()).toEqual(['arrival', 'caseId', 'drivingMinutes', 'kilometres', 'lat', 'lon', 'place', 'visit', 'workType'])
    }
  })

  it('has only that technician’s stops of that day, in visit order, with names instead of numbers', () => {
    const { input, result, tech, day } = fixture()
    const pack = buildPack('Test centre', input, result, tech, day, CREATED)
    const expected = result.scheduled.filter((s) => s.tech === tech && s.day === day).sort((a, b) => a.visit - b.visit)
    expect(pack.stops.map((s) => s.caseId)).toEqual(expected.map((s) => s.id))
    expect(pack.stops.map((s) => s.visit)).toEqual(expected.map((s) => s.visit))
    expect(pack.technician).toBe(input.technicians[tech].name)
    expect(pack.stops.every((s) => s.workType === 'Service' && ['North', 'South'].includes(s.place))).toBe(true)
    expect(pack.stops.every((s) => /^\d{2}:\d{2}$/.test(s.arrival))).toBe(true)
  })

  it('is valid for its own date and records the site and when it was made', () => {
    const { input, result, tech, day } = fixture()
    const pack = buildPack('Test centre', input, result, tech, day, CREATED)
    expect(pack).toMatchObject({ packVersion: 1, site: 'Test centre', createdAt: CREATED, date: '2026-10-13', validFor: '2026-10-13' })
  })

  it('takes the coordinates of the place of each stop', () => {
    const { input, result, tech, day } = fixture()
    const pack = buildPack('Test centre', input, result, tech, day, CREATED)
    for (const s of pack.stops) {
      const at = s.place === 'North' ? { lat: 20.1, lon: 30.05 } : { lat: 19.95, lon: 30.1 }
      expect(s).toMatchObject(at)
    }
  })
})

describe('serialisePack and parsePack', () => {
  it('give back the same pack, and the file ends with a newline', () => {
    const { input, result, tech, day } = fixture()
    const pack = buildPack('Test centre', input, result, tech, day, CREATED)
    const text = serialisePack(pack)
    expect(text.endsWith('\n')).toBe(true)
    expect(parsePack(text)).toEqual(pack)
  })

  it('drops fields it does not know, so a customer name in a file is never shown', () => {
    const { input, result, tech, day } = fixture()
    const raw = JSON.parse(serialisePack(buildPack('Test centre', input, result, tech, day, CREATED))) as Record<string, unknown>
    raw.customerName = 'Someone'
    ;(raw.stops as Record<string, unknown>[])[0].customerPhone = '123'
    const parsed = parsePack(JSON.stringify(raw))
    expect(JSON.stringify(parsed)).not.toContain('Someone')
    expect(JSON.stringify(parsed)).not.toContain('123')
    expect(Object.keys(parsed).sort()).toEqual(['createdAt', 'date', 'packVersion', 'site', 'stops', 'technician', 'validFor'])
  })

  const good = (): RoutePack => {
    const { input, result, tech, day } = fixture()
    return buildPack('Test centre', input, result, tech, day, CREATED)
  }
  const fails = (change: (p: Record<string, unknown>) => void, message: RegExp | string) => {
    const raw = JSON.parse(JSON.stringify(good())) as Record<string, unknown>
    change(raw)
    expect(() => parsePack(JSON.stringify(raw))).toThrow(message)
  }

  it('says plainly when the file is not a route pack', () => {
    expect(() => parsePack('nope {')).toThrow('This file is not a route pack.')
    expect(() => parsePack('[]')).toThrow('This file is not a route pack.')
    expect(() => parsePack('{"hello": 1}')).toThrow('This file is not a route pack.')
    expect(() => parsePack('nope {')).toThrow(PackError)
  })
  it('refuses a pack made by another version of the app', () => {
    fails((p) => { p.packVersion = 2 }, 'This route pack was made by a different version of the app.')
  })
  it('refuses a pack with a missing or empty technician, site, dates or stops', () => {
    fails((p) => { p.technician = '' }, 'The technician’s name is missing.')
    fails((p) => { p.date = '13/10/2026' }, 'The date is not written as year-month-day.')
    fails((p) => { p.validFor = 'tomorrow' }, 'The valid-for date is not written as year-month-day.')
    fails((p) => { p.createdAt = 'yesterday' }, 'The time the pack was made is not readable.')
    fails((p) => { p.stops = [] }, 'This route pack has no stops.')
    fails((p) => { delete p.stops }, 'This route pack has no stops.')
  })
  it('refuses a stop with a bad time, place on the map or number, and says which stop', () => {
    fails((p) => { (p.stops as Record<string, unknown>[])[0].arrival = '9:5' }, 'Stop 1: the arrival time is not written like 09:30.')
    fails((p) => { (p.stops as Record<string, unknown>[])[0].lat = 95 }, 'Stop 1: the latitude must be between -90 and 90.')
    fails((p) => { (p.stops as Record<string, unknown>[])[0].lon = 'east' }, 'Stop 1: the longitude must be between -180 and 180.')
    fails((p) => { (p.stops as Record<string, unknown>[])[0].caseId = '' }, 'Stop 1: the case number is missing.')
    fails((p) => { (p.stops as Record<string, unknown>[])[0].kilometres = -1 }, 'Stop 1: the distance must be a number of kilometres, 0 or more.')
  })
  it('refuses two stops with the same visit number', () => {
    fails((p) => {
      const stops = p.stops as Record<string, unknown>[]
      if (stops.length < 2) throw new Error('fixture needs two stops')
      stops[1].visit = stops[0].visit
    }, 'Two stops have the same visit number.')
  })
})

describe('packFileName', () => {
  it('uses the technician and the date, with letters, digits and dashes only', () => {
    const p = { ...({} as RoutePack), technician: 'Asha K.', date: '2026-11-22' }
    expect(packFileName(p)).toBe('route-asha-k-2026-11-22.json')
    expect(packFileName({ ...p, technician: 'José Núñez / North' })).toBe('route-jose-nunez-north-2026-11-22.json')
    expect(packFileName({ ...p, technician: '!!!' })).toBe('route-technician-2026-11-22.json')
  })
})

describe('staleness', () => {
  const pack = { validFor: '2026-10-13' } as RoutePack
  it('is not past on the day or before it', () => {
    expect(staleness(pack, '2026-10-13')).toEqual({ past: false, daysAgo: 0 })
    expect(staleness(pack, '2026-10-12')).toEqual({ past: false, daysAgo: 0 })
  })
  it('is past the day after, and counts the days', () => {
    expect(staleness(pack, '2026-10-14')).toEqual({ past: true, daysAgo: 1 })
    expect(staleness(pack, '2026-10-20')).toEqual({ past: true, daysAgo: 7 })
  })
})
