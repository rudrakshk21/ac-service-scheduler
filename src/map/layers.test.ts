import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { plan } from '../engine/index'
import type { StoredCase } from '../intake/import/merge'
import { prepare } from '../screens/plan/planData'
import { buildPack } from '../share/routePack'
import { emptyWorkspace, type Workspace } from '../workspace/workspace'
import { dayLayers, labelsFor, packLayers, PALETTE_SIZE } from './layers'

const stored = (id: string, over: Partial<StoredCase> = {}): StoredCase => ({
  caseId: id, workTypeName: 'Service', place: 'North', state: 'active', reportedAt: '2026-10-10', overrides: {},
  firstImported: '2026-10-13', lastImported: '2026-10-13', ...over,
})
function fixture(technicians?: Workspace['technicians']) {
  const w = emptyWorkspace()
  const ws: Workspace = {
    ...w,
    site: { ...w.site, name: 'Test centre', places: [{ name: 'North', latitude: 20.1, longitude: 30.05 }, { name: 'South', latitude: 19.95, longitude: 30.1 }, { name: 'Depot', latitude: 20.0, longitude: 30.2 }] },
    technicians: technicians ?? [{ name: 'Asha K.', skills: ['Service'], active: true }, { name: 'Bo', skills: ['Service'], active: true }],
    cases: [stored('10'), stored('9'), stored('100', { place: 'South' }), stored('7'), stored('8', { place: 'South' })],
  }
  const p = prepare(ws, '2026-10-13')
  if (!p.ok) throw new Error(p.text)
  const result = plan(p.input)
  const day = result.scheduled[0].day
  return { input: p.input, result, day }
}

describe('labelsFor', () => {
  it('uses the first letter of each name, in capitals', () => {
    expect(labelsFor(['Asha K.', 'bilal', 'Chitra'])).toEqual(['A', 'B', 'C'])
  })
  it('lengthens the label until each one is different', () => {
    expect(labelsFor(['Asha', 'Anil', 'Bo'])).toEqual(['As', 'An', 'B'])
    expect(labelsFor(['Ann', 'Anil'])).toEqual(['Ann', 'Ani'])
  })
  it('gives names that stay alike a spare letter, so no two labels are alike', () => {
    expect(labelsFor(['Sam', 'Sam', 'Sam'])).toEqual(['A', 'B', 'C'])
  })
  it('keeps a label short when names only differ by a number: a label is never longer than the marker can hold', () => {
    const labels = labelsFor(['Technician 01', 'Technician 02', 'Technician 03', 'Technician 04'])
    expect(labels).toEqual(['A', 'B', 'C', 'D'])
    expect(labelsFor(['Tech 1', 'Tech 10'])).toEqual(['A', 'B'])
  })
  it('never ends a label with a digit, which would read as the visit number that follows it', () => {
    for (const label of labelsFor(['Team 1', 'Team 2', 'Asha 7', 'Asha 8', 'Bo'])) expect(label).not.toMatch(/\d$/)
  })
  it('takes a spare letter that no other label uses', () => {
    expect(labelsFor(['Asha', 'Technician 01', 'Technician 02'])).toEqual(['A', 'B', 'C'])
    expect(labelsFor(['B', 'Technician 01', 'Technician 02'])).toEqual(['B', 'A', 'C'])
  })
  it('goes on to two letters when more than 26 names are alike', () => {
    const labels = labelsFor(Array.from({ length: 30 }, (_, i) => `Technician ${i + 1}`))
    expect(new Set(labels).size).toBe(30)
    expect(labels[26]).toBe('AA')
  })
  it('gives every label at most three characters, and no two the same, whatever the names', () => {
    const name = fc.string({ maxLength: 14 })
    fc.assert(
      fc.property(fc.array(name, { maxLength: 40 }), (names) => {
        const labels = labelsFor(names)
        expect(new Set(labels.map((l) => l.toLocaleLowerCase())).size).toBe(names.length)
        for (const l of labels) expect(Array.from(l).length).toBeLessThanOrEqual(3)
      }),
    )
  })
  it('copes with an empty name and an empty list', () => {
    expect(labelsFor([''])).toEqual(['1'])
    expect(labelsFor([])).toEqual([])
  })
})

describe('dayLayers', () => {
  it('has one layer for each technician with visits on the day, in technician order, with the base', () => {
    const { input, result, day } = fixture()
    const data = dayLayers(input, result, day)
    expect(data.base).toEqual({ lat: input.settings.baseLat, lon: input.settings.baseLon })
    const tech = result.scheduled.filter((s) => s.day === day).map((s) => s.tech)
    expect(data.layers.map((l) => l.name)).toEqual([...new Set(tech)].sort((a, b) => a - b).map((t) => input.technicians[t].name))
  })

  it('lists the stops of a layer in visit order with their case, arrival, place and coordinates', () => {
    const { input, result, day } = fixture()
    const layer = dayLayers(input, result, day).layers[0]
    const tech = input.technicians.findIndex((t) => t.name === layer.name)
    const expected = result.scheduled.filter((s) => s.tech === tech && s.day === day).sort((a, b) => a.visit - b.visit)
    expect(layer.stops.map((s) => s.caseId)).toEqual(expected.map((s) => s.id))
    expect(layer.stops.map((s) => s.visit)).toEqual(expected.map((s) => s.visit))
    expect(layer.stops.map((s) => s.arrival)).toEqual(expected.map((s) => s.eta))
    for (const s of layer.stops) {
      const at = s.place === 'North' ? { lat: 20.1, lon: 30.05 } : { lat: 19.95, lon: 30.1 }
      expect(s).toMatchObject(at)
    }
  })

  it('draws each path from the base, through the stops, back to the base', () => {
    const { input, result, day } = fixture()
    const data = dayLayers(input, result, day)
    for (const layer of data.layers) {
      expect(layer.path[0]).toEqual(data.base)
      expect(layer.path.at(-1)).toEqual(data.base)
      expect(layer.path).toHaveLength(layer.stops.length + 2)
    }
  })

  it('starts and ends a path at the technician’s own places when they have them', () => {
    const { input, result, day } = fixture([
      { name: 'Asha K.', skills: ['Service'], active: true, startPlace: 'Depot', endPlace: 'South' },
      { name: 'Bo', skills: ['Service'], active: true },
    ])
    const data = dayLayers(input, result, day)
    const asha = data.layers.find((l) => l.name === 'Asha K.')
    if (asha === undefined) throw new Error('Asha has no visits in the fixture')
    expect(asha.path[0]).toEqual({ lat: 20.0, lon: 30.2 })
    expect(asha.path.at(-1)).toEqual({ lat: 19.95, lon: 30.1 })
  })

  it('gives each technician a colour from the palette by their place in the list, and a distinct label', () => {
    const { input, result, day } = fixture()
    const data = dayLayers(input, result, day)
    for (const l of data.layers) {
      const tech = input.technicians.findIndex((t) => t.name === l.name)
      expect(l.colour).toBe(tech % PALETTE_SIZE)
    }
    expect(new Set(data.layers.map((l) => l.label)).size).toBe(data.layers.length)
  })

  it('has no layers for a day without visits', () => {
    const { input, result } = fixture()
    expect(dayLayers(input, result, 1).layers).toEqual([])
  })
})

describe('packLayers', () => {
  it('draws the stops of a route pack in order as one layer, with no base', () => {
    const { input, result, day } = fixture()
    const tech = result.scheduled.find((s) => s.day === day)?.tech ?? 0
    const pack = buildPack('Test centre', input, result, tech, day, '2026-10-13T10:00:00.000Z')
    const data = packLayers(pack)
    expect(data.base).toBeNull()
    expect(data.layers).toHaveLength(1)
    expect(data.layers[0].name).toBe(pack.technician)
    expect(data.layers[0].stops.map((s) => s.caseId)).toEqual(pack.stops.map((s) => s.caseId))
    expect(data.layers[0].path).toHaveLength(pack.stops.length)
  })
})
