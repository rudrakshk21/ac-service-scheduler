import { START } from '../../engine/testing/fixtures'
import { rng } from '../../engine/testing/generate'
import type { ImportedTechnician } from '../map/apply'
import type { Kind, StatusAction } from '../map/model'
import { serializeCsv } from '../read/csv'
import type { ReadOptions } from '../read/table'
import { extendPlaces, type SiteProfile } from '../site/site'
import { starterSite } from '../site/starter'
import { makeXlsx } from './xlsx'

/** Invented conformance data sets DS-2 to DS-6. Every name, number and place here is made up. */
export interface DatasetFile {
  name: string
  kind: Kind
  bytes: Uint8Array
  options?: ReadOptions
}

export interface Expected {
  /** Cases after duplicates and total rows are left out. */
  caseCount: number
  duplicates: number
  totalRows: number
  /** Cases that end up `active` once the user has mapped the unknown values. */
  active: number
  /** Field to the column header it must be suggested for (case file). */
  mapped: Record<string, string>
  /** What the user decides on the mapping screen. */
  valueMaps: { workType: Record<string, string>; status: Record<string, StatusAction>; priority: Record<string, string>; skill: Record<string, string> }
  /** The day and month order the user confirms when it is ambiguous. */
  dateOrder?: 'dmy' | 'mdy' | 'ymd'
  singleWorkType?: string
  /** The first pass, before the user maps categories, reports unknown work type values. */
  unknownBefore: boolean
  needsDateOrder: boolean
}

export interface Dataset {
  name: string
  files: DatasetFile[]
  site: SiteProfile
  technicians: ImportedTechnician[]
  expected: Expected
}

export const DATASET_NAMES = ['DS-2', 'DS-3', 'DS-4', 'DS-5', 'DS-6'] as const
export type DatasetName = (typeof DATASET_NAMES)[number]

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)
function latin1(s: string): Uint8Array {
  return Uint8Array.from([...s].map((c) => {
    const n = c.charCodeAt(0)
    if (n > 255) throw new Error(`"${c}" is not a Windows-1252 character`)
    return n
  }))
}
function utf16le(s: string): Uint8Array {
  const out = [0xff, 0xfe]
  for (const ch of s) out.push(ch.charCodeAt(0) & 255, ch.charCodeAt(0) >> 8)
  return Uint8Array.from(out)
}
const p2 = (n: number): string => String(n).padStart(2, '0')
const isoOf = (day: number): string => new Date(day * 86_400_000).toISOString().slice(0, 10)
const round5 = (x: number): number => Math.round(x * 1e5) / 1e5

interface Place { name: string; lat: number; lon: number; postal: string }
function region(seed: number, lat: number, lon: number, names: string[]): Place[] {
  const r = rng(seed)
  return names.map((name, i) => ({ name, lat: round5(lat + (r() - 0.5) * 0.4), lon: round5(lon + (r() - 0.5) * 0.4), postal: `5000${p2(i)}` }))
}
const numbered = (n: number): string[] => Array.from({ length: n }, (_, i) => `Place ${p2(i + 1)}`)

function siteAt(lat: number, lon: number, name: string, places: Place[] = []): SiteProfile {
  const s = starterSite()
  s.name = name
  s.settings.baseLat = lat
  s.settings.baseLon = lon
  return extendPlaces(s, places.map((p) => ({ name: p.name, latitude: p.lat, longitude: p.lon, postalCode: p.postal })))
}

const SKILLS = ['Installation', 'Service', 'Breakdown']
function technicians(): ImportedTechnician[] {
  return Array.from({ length: 9 }, (_, i) => ({ name: `Technician ${p2(i + 1)}`, skills: [SKILLS[i % 3]], active: true }))
}

const noMaps = { workType: {}, status: {}, priority: {}, skill: {} }

/** DS-2: a plain English CSV in UTF-8. */
function ds2(): Dataset {
  const r = rng(2)
  const places = region(22, 20, 30, numbered(10))
  const cats = ['Installation', 'Repair', 'Gas Refill']
  const rows: string[][] = []
  let active = 0
  for (let i = 0; i < 60; i++) {
    const x = r()
    const status = x < 0.7 ? 'Open' : x < 0.85 ? 'Pending Parts' : 'Closed'
    if (status === 'Open') active += 1
    rows.push([String(100001 + i), isoOf(START - Math.floor(r() * 30)), cats[Math.floor(r() * 3)], places[Math.floor(r() * 10)].name, status])
  }
  const csv = serializeCsv([['Ticket No', 'Created On', 'Category', 'Locality', 'Status'], ...rows], ',')
  return {
    name: 'DS-2',
    files: [{ name: 'cases.csv', kind: 'cases', bytes: utf8(csv) }],
    site: siteAt(20, 30, 'DS-2 site', places),
    technicians: technicians(),
    expected: {
      caseCount: 60, duplicates: 0, totalRows: 0, active,
      mapped: { caseId: 'Ticket No', reportedAt: 'Created On', workType: 'Category', area: 'Locality', status: 'Status' },
      valueMaps: {
        workType: { installation: 'Installation', repair: 'Service', 'gas refill': 'Breakdown' },
        status: { open: 'schedule', 'pending parts': 'hold', closed: 'ignore' }, priority: {}, skill: {},
      },
      unknownBefore: true, needsDateOrder: false,
    },
  }
}

/** DS-3: German headers, semicolons, decimal commas, day-first dates, Windows-1252 bytes, a title line and a total row. */
function ds3(): Dataset {
  const r = rng(3)
  const places = region(33, 50.9, 7.0, ['Köln-Nord', 'Düsseldorf', 'München', 'Münster', 'Aachen', 'Bonn', 'Essen', 'Jülich', 'Köln-Süd', 'Würzburg'])
  const cats = ['Installation', 'Reparatur', 'Gasfüllung']
  const comma = (x: number): string => x.toFixed(5).replace('.', ',')
  const german = (day: number): string => { const [y, m, d] = isoOf(day).split('-'); return `${d}.${m}.${y}` }
  const rows: string[][] = [['Auftragsexport 2026', '', '', '', '', '', '']]
  rows.push(['Auftragsnummer', 'Erstellt am', 'Kategorie', 'Ort', 'Priorität', 'Breitengrad', 'Längengrad'])
  for (let i = 0; i < 60; i++) {
    const p = places[Math.floor(r() * 10)]
    rows.push([String(200001 + i), german(START - Math.floor(r() * 30)), cats[Math.floor(r() * 3)], p.name, r() < 0.2 ? 'Dringend' : 'Normal', comma(p.lat), comma(p.lon)])
  }
  rows.push(['Gesamt', '', '', '', '', '', ''])
  return {
    name: 'DS-3',
    files: [{ name: 'auftraege.csv', kind: 'cases', bytes: latin1(serializeCsv(rows, ';')) }],
    site: siteAt(50.9, 7.0, 'DS-3 site'),
    technicians: technicians(),
    expected: {
      caseCount: 60, duplicates: 0, totalRows: 1, active: 60,
      mapped: { caseId: 'Auftragsnummer', reportedAt: 'Erstellt am', workType: 'Kategorie', area: 'Ort', priority: 'Priorität', latitude: 'Breitengrad', longitude: 'Längengrad' },
      valueMaps: {
        workType: { installation: 'Installation', reparatur: 'Service', gasfullung: 'Breakdown' },
        status: {}, priority: { dringend: 'Escalated' }, skill: {},
      },
      dateOrder: 'dmy', unknownBefore: true, needsDateOrder: false,
    },
  }
}

/** DS-4: an Excel workbook with a cover sheet, Excel date cells, coordinates only, personal columns, duplicate tickets,
 *  and a separate technician workbook. */
async function ds4(): Promise<Dataset> {
  const r = rng(4)
  const places = region(44, 12.97, 77.59, numbered(8))
  const cats = ['AC Install', 'AC Repair', 'Gas Top-up']
  const rows: (string | number | Date | null)[][] = [['Job No', 'Logged On', 'Nature of Complaint', 'Lat', 'Lng', 'Customer Name', 'Phone']]
  for (let i = 0; i < 60; i++) {
    const p = places[Math.floor(r() * 8)]
    rows.push([String(300001 + i), new Date((START - Math.floor(r() * 30)) * 86_400_000 + 12 * 3_600_000), cats[Math.floor(r() * 3)], p.lat, p.lon, `Person ${i + 1}`, `555-01${p2(i)}`])
  }
  rows.push(rows[1], rows[2], rows[3])
  const cases = await makeXlsx([
    { sheet: 'Cover', rows: [['Service export'], ['Generated by the ticket system']] },
    { sheet: 'Cases', rows },
  ])
  const techRows: (string | null)[][] = [['Name', 'Skills', 'Start Area']]
  technicians().forEach((t, i) => techRows.push([t.name, ['AC Install', 'AC Repair', 'Gas Top-up'][i % 3], null]))
  const techs = await makeXlsx([{ sheet: 'Technicians', rows: techRows }])
  return {
    name: 'DS-4',
    files: [
      { name: 'service.xlsx', kind: 'cases', bytes: cases, options: { sheet: 'Cases' } },
      { name: 'technicians.xlsx', kind: 'technicians', bytes: techs },
    ],
    site: siteAt(12.97, 77.59, 'DS-4 site'),
    technicians: technicians(),
    expected: {
      caseCount: 60, duplicates: 3, totalRows: 0, active: 60,
      mapped: { caseId: 'Job No', reportedAt: 'Logged On', workType: 'Nature of Complaint', latitude: 'Lat', longitude: 'Lng' },
      valueMaps: {
        workType: { 'ac install': 'Installation', 'ac repair': 'Service', 'gas top up': 'Breakdown' },
        status: {}, priority: {}, skill: { 'ac install': 'Installation', 'ac repair': 'Service', 'gas top up': 'Breakdown' },
      },
      unknownBefore: true, needsDateOrder: false,
    },
  }
}

/** DS-5: JSON from a system, nested location, ISO timestamps with offsets, priority codes, an unknown category. */
function ds5(): Dataset {
  const r = rng(5)
  const places = region(55, 40.7, -74.0, ['Harbor', 'Midtown', 'Uptown', 'Riverside', 'Old Mill', 'Hilltop'])
  const cats = ['AC install', 'AC repair', 'Gas top-up', 'Cleaning']
  const tickets = Array.from({ length: 60 }, (_, i) => {
    const p = places[Math.floor(r() * 6)]
    const due = r() < 0.4 ? { due: isoOf(START + 2 + Math.floor(r() * 8)) } : {}
    return {
      id: String(400001 + i),
      created: `${isoOf(START - Math.floor(r() * 30))}T08:30:00+05:30`,
      category: cats[Math.floor(r() * 4)],
      location: { lat: p.lat, lon: p.lon, city: p.name },
      priority: `P${1 + Math.floor(r() * 4)}`,
      ...due,
    }
  })
  return {
    name: 'DS-5',
    files: [{ name: 'tickets.json', kind: 'cases', bytes: utf8(JSON.stringify({ exportedAt: isoOf(START), tickets })) }],
    site: siteAt(40.7, -74.0, 'DS-5 site'),
    technicians: technicians(),
    expected: {
      caseCount: 60, duplicates: 0, totalRows: 0, active: 60,
      mapped: { caseId: 'id', reportedAt: 'created', workType: 'category', area: 'location.city', latitude: 'location.lat', longitude: 'location.lon', priority: 'priority', dueAt: 'due' },
      valueMaps: {
        workType: { 'ac install': 'Installation', 'ac repair': 'Service', 'gas top up': 'Breakdown', cleaning: 'Service' },
        status: {}, priority: { p1: 'Escalated', p2: 'Escalated', p3: 'Normal', p4: 'Normal' }, skill: {},
      },
      unknownBefore: true, needsDateOrder: false,
    },
  }
}

/** DS-6: UTF-16 tab file, dates in which day and month cannot be told apart, no category column, postal codes only. */
function ds6(): Dataset {
  const r = rng(6)
  const places = region(66, -33.87, 151.21, numbered(8))
  const rows: string[][] = [['Complaint No', 'Registration Date', 'Postcode', 'Status']]
  let active = 0
  for (let i = 0; i < 60; i++) {
    const status = r() < 0.8 ? 'Open' : 'Hold'
    if (status === 'Open') active += 1
    rows.push([String(500001 + i), `${p2(1 + Math.floor(r() * 12))}/${p2(9 + Math.floor(r() * 4))}/2026`, places[Math.floor(r() * 8)].postal, status])
  }
  return {
    name: 'DS-6',
    files: [{ name: 'complaints.txt', kind: 'cases', bytes: utf16le(serializeCsv(rows, '\t')) }],
    site: siteAt(-33.87, 151.21, 'DS-6 site', places),
    technicians: technicians(),
    expected: {
      caseCount: 60, duplicates: 0, totalRows: 0, active,
      mapped: { caseId: 'Complaint No', reportedAt: 'Registration Date', postalCode: 'Postcode', status: 'Status' },
      valueMaps: { ...noMaps, status: { open: 'schedule', hold: 'hold' } },
      dateOrder: 'dmy', singleWorkType: 'Service', unknownBefore: false, needsDateOrder: true,
    },
  }
}

export async function buildDataset(name: DatasetName): Promise<Dataset> {
  switch (name) {
    case 'DS-2': return ds2()
    case 'DS-3': return ds3()
    case 'DS-4': return ds4()
    case 'DS-5': return ds5()
    case 'DS-6': return ds6()
  }
}
