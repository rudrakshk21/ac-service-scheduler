import { describe, expect, it } from 'vitest'
import { applyProfile } from '../map/apply'
import { suggestProfile } from '../map/suggest'
import { readSource } from '../read'
import { starterSite } from '../site/starter'
import { sampleFiles } from './sampleData'

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s)

async function importBoth(cases: number, technicians: number, seed?: number) {
  const files = sampleFiles({ cases, technicians, seed })
  const site = starterSite()
  const casesTable = await readSource(bytes(files.cases), 'cases.csv')
  const techTable = await readSource(bytes(files.technicians), 'technicians.csv')
  const c = applyProfile(casesTable, suggestProfile(casesTable, 'cases', site, 'cases.csv').profile, site, '2026-11-22')
  const t = applyProfile(techTable, suggestProfile(techTable, 'technicians', site, 'technicians.csv').profile, site, '2026-11-22')
  return { files, c, t }
}

describe('sampleFiles: invented files for trying the app (for instance on a phone)', () => {
  it('make files the importer reads without a single problem, for the size asked', async () => {
    const { c, t } = await importBoth(300, 20)
    expect(c.cases).toHaveLength(300)
    expect(c.exceptions).toEqual([])
    expect(c.quality.unknownValues).toEqual([])
    expect(t.technicians).toHaveLength(20)
    expect(t.exceptions).toEqual([])
  })

  it('give every work type a technician with the skill, so each case can be planned', async () => {
    const { t, c } = await importBoth(60, 6)
    const skills = new Set(t.technicians.flatMap((x) => x.skills))
    const types = new Set(c.cases.map((x) => x.workTypeName))
    for (const type of types) expect(skills.has(type as string)).toBe(true)
  })

  it('are the same for the same seed and different for another', () => {
    const a = sampleFiles({ cases: 30, technicians: 4, seed: 1 })
    expect(sampleFiles({ cases: 30, technicians: 4, seed: 1 })).toEqual(a)
    expect(sampleFiles({ cases: 30, technicians: 4, seed: 2 }).cases).not.toBe(a.cases)
  })

  it('hold only made-up names and numbers: no email, no phone, no address', () => {
    const { cases, technicians } = sampleFiles({ cases: 50, technicians: 5 })
    for (const text of [cases, technicians]) {
      expect(text).not.toMatch(/@/)
      expect(text).not.toMatch(/\d{8,}/)
    }
    expect(technicians).toMatch(/Technician 01/)
  })

  it('refuse a size that makes no sense', () => {
    expect(() => sampleFiles({ cases: 0, technicians: 3 })).toThrow(/cases/)
    expect(() => sampleFiles({ cases: 10, technicians: 0 })).toThrow(/technicians/)
    expect(() => sampleFiles({ cases: 60_000, technicians: 3 })).toThrow(/50,000/)
  })
})
