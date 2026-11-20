import { describe, expect, it } from 'vitest'
import { plan } from '../engine/index'
import { mergeImport } from './import/merge'
import { toPlanInput } from './import/plan-input'
import { applyProfile } from './map/apply'
import type { MappingProfile } from './map/profile'
import { suggestProfile } from './map/suggest'
import { readSource } from './read/index'
import { extendPlaces } from './site/site'
import { buildDataset, DATASET_NAMES, type Dataset } from './testing/datasets'

const IMPORT = '2026-10-13'
const EMPTY_MAPS = { workType: {}, status: {}, priority: {}, skill: {} }

/** What a user does on the mapping screen for the case file: confirm the suggestions, the date order and the value maps. */
async function caseFile(d: Dataset) {
  const file = d.files.find((f) => f.kind === 'cases')
  if (file === undefined) throw new Error('no case file')
  const table = await readSource(file.bytes, file.name, file.options)
  const suggested = suggestProfile(table, 'cases', d.site)
  const base: MappingProfile = {
    ...suggested.profile,
    formats: { ...suggested.profile.formats, ...(suggested.needsDateOrder ? { dateOrder: d.expected.dateOrder } : {}) },
  }
  const confirmed: MappingProfile = {
    ...base,
    valueMaps: d.expected.valueMaps,
    ...(d.expected.singleWorkType === undefined ? {} : { singleWorkType: d.expected.singleWorkType }),
  }
  return { table, suggested, firstPass: { ...base, ...(d.expected.singleWorkType === undefined ? {} : { singleWorkType: d.expected.singleWorkType }), valueMaps: EMPTY_MAPS }, confirmed }
}

describe.each(DATASET_NAMES)('conformance data set %s', (name) => {
  it('imports and plans with no code change', async () => {
    const d = await buildDataset(name)
    const { table, suggested, firstPass, confirmed } = await caseFile(d)

    // Detection: the format surprises of each set are handled or reported, never silently wrong.
    expect(suggested.needsDateOrder).toBe(d.expected.needsDateOrder)
    expect(table.rows.length).toBeGreaterThanOrEqual(d.expected.caseCount)

    // First pass, before the user maps categories: unknown values are reported once each.
    const first = applyProfile(table, firstPass, d.site, IMPORT)
    const unknownTypes = first.quality.unknownValues.find((u) => u.field === 'workType')
    if (d.expected.unknownBefore) expect(unknownTypes?.values.length ?? 0).toBeGreaterThan(0)
    else expect(unknownTypes).toBeUndefined()

    // After the user's mapping: every defect of the set is accounted for.
    const out = applyProfile(table, confirmed, d.site, IMPORT)
    expect(out.cases.length).toBe(d.expected.caseCount)
    expect(out.quality.duplicates).toBe(d.expected.duplicates)
    expect(out.quality.totalRowsSkipped).toBe(d.expected.totalRows)
    expect(out.exceptions.filter((e) => e.issue === 'unknown_work_type')).toEqual([])
    expect(out.exceptions.filter((e) => e.issue === 'no_location')).toEqual([])
    expect(out.exceptions.filter((e) => e.issue === 'bad_date')).toEqual([])
    expect(out.cases.filter((c) => c.state === 'active').length).toBe(d.expected.active)

    // Personal columns never reach the output.
    const json = JSON.stringify(out)
    expect(json).not.toContain('Person ')
    expect(json).not.toContain('555-01')

    // Merge, hand off and plan.
    const merged = mergeImport([], out, IMPORT)
    expect(merged.preview.new).toBe(d.expected.caseCount)
    const site = extendPlaces(d.site, out.places)
    const { input, caseIds } = toPlanInput(site, merged.cases, d.technicians, { planStart: IMPORT, importDate: IMPORT })
    expect(caseIds.length).toBe(d.expected.active)
    const result = plan(input)
    expect(result.scheduled.length).toBeGreaterThanOrEqual(Math.floor(0.8 * d.expected.active))
  })
})

describe('technician file of DS-4', () => {
  it('imports the technicians with their skills', async () => {
    const d = await buildDataset('DS-4')
    const file = d.files.find((f) => f.kind === 'technicians')
    if (file === undefined) throw new Error('no technician file')
    const table = await readSource(file.bytes, file.name)
    const s = suggestProfile(table, 'technicians', d.site)
    expect(s.profile.columns).toMatchObject({ name: ['Name'], skills: ['Skills'] })
    const out = applyProfile(table, { ...s.profile, valueMaps: d.expected.valueMaps }, d.site, IMPORT)
    expect(out.technicians.map((t) => [t.name, t.skills])).toEqual(d.technicians.map((t) => [t.name, t.skills]))
    expect(out.quality.unknownValues).toEqual([])
  })
})

describe('column suggestions across the conformance sets', () => {
  it('are right for at least 80% of the mandatory and recommended fields', async () => {
    let right = 0
    let total = 0
    const misses: string[] = []
    for (const name of DATASET_NAMES) {
      const d = await buildDataset(name)
      const { suggested } = await caseFile(d)
      for (const [field, header] of Object.entries(d.expected.mapped)) {
        total += 1
        const s = suggested.suggestions.find((x) => x.field === field)
        if (s !== undefined && s.confidence >= 0.8 && s.columns.includes(header)) right += 1
        else misses.push(`${name}.${field} (${header})`)
      }
    }
    expect(misses).toEqual([])
    expect(right / total).toBeGreaterThanOrEqual(0.8)
  })
})
