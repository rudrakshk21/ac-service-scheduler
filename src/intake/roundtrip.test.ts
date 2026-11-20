import { describe, expect, it } from 'vitest'
import { plan } from '../engine/index'
import { compareResults } from '../engine/testing/compare'
import type { PlanInput, PlanResult } from '../engine/types'
import { mergeImport } from './import/merge'
import { toPlanInput } from './import/plan-input'
import { applyProfile } from './map/apply'
import { isOpenFormat, openFormatProfile } from './open-format'
import { readSource } from './read/index'
import { extendPlaces } from './site/site'
import { filesFromInput, isoOf, siteFromInput } from './testing/roundtrip'

interface Golden {
  name: string
  input: PlanInput
  expected: PlanResult
}
const found = import.meta.glob('../../reference/golden/*.json', { eager: true, import: 'default' }) as Record<string, Golden>
const goldens = new Map(Object.values(found).map((g) => [g.name, g]))

// Scenarios whose every feature the open data format carries. `frozen` (a plan kept from an earlier run), the
// per-technician lunch start and the priority levels with names of their own are not part of the open format.
const SCENARIOS = ['baseline_mid', 'three_techs_default', 'tech_inactive', 'tech_leave', 'holiday', 'pins', 'due_dates', 'due_dates_strong', 'product_types', 'home_and_depot'] as const

const utf8 = (s: string) => new TextEncoder().encode(s)

describe('an invented plan survives the trip through files', () => {
  it.each(SCENARIOS)('%s: written as open-format files, imported, planned: the same plan', async (name) => {
    const golden = goldens.get(name)
    if (golden === undefined) throw new Error(`golden file ${name} is missing`)
    const input = golden.input
    const files = filesFromInput(input)
    const importDate = isoOf(input.settings.startDay)

    const read = async (text: string, file: string) => readSource(utf8(text), file)
    const casesTable = await read(files.cases, 'cases.csv')
    const techTable = await read(files.technicians, 'technicians.csv')
    const placesTable = await read(files.places, 'places.csv')
    expect(isOpenFormat(casesTable.headers, 'cases')).toBe(true)
    expect(isOpenFormat(techTable.headers, 'technicians')).toBe(true)
    expect(isOpenFormat(placesTable.headers, 'places')).toBe(true)

    const site0 = siteFromInput(input)
    const places = applyProfile(placesTable, openFormatProfile('places'), site0, importDate)
    expect(places.exceptions).toEqual([])
    const site = extendPlaces(site0, places.places)
    const techs = applyProfile(techTable, openFormatProfile('technicians'), site, importDate)
    expect(techs.exceptions).toEqual([])
    expect(techs.quality.unknownValues).toEqual([])
    const cases = applyProfile(casesTable, openFormatProfile('cases'), site, importDate)
    expect(cases.exceptions).toEqual([])
    expect(cases.quality.unknownValues.filter((u) => u.field === 'workType')).toEqual([])

    const merged = mergeImport([], cases, importDate)
    const { input: again, caseIds } = toPlanInput(site, merged.cases, techs.technicians, {
      planStart: importDate,
      holidays: input.settings.holidays.map(isoOf),
      importDate,
    })
    expect(caseIds).toEqual(input.cases.map((c) => c.id))

    // The engine adds "; priority <level>" to the reason of a case that sets a priority level; the original sets none.
    const result = plan(again)
    const stripped: PlanResult = { ...result, scheduled: result.scheduled.map((s) => ({ ...s, why: s.why.replace(/; priority [^;]*$/, '') })) }
    expect(compareResults(stripped, golden.expected)).toEqual([])
  })
})
