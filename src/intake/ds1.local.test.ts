import { describe, expect, it } from 'vitest'
import { plan } from '../engine/index'
import { compareResults } from '../engine/testing/compare'
import type { PlanResult } from '../engine/types'
import { mergeImport } from './import/merge'
import { toPlanInput } from './import/plan-input'
import { applyProfile } from './map/apply'
import { parseProfile } from './map/profile'
import { readSource } from './read/index'
import { extendPlaces, parseSite } from './site/site'

// Local only. The real data of reference data set DS-1 never enters the repository. This test runs only when the
// git-ignored folder `reference-local/` holds, next to the exported plan `ds1_baseline.json`:
//   ds1-files/cases.csv, ds1-files/places.csv, ds1-files/technicians.csv   (the owner's files, saved as CSV)
//   ds1-profiles/cases.json, places.json, technicians.json, site.json     (written once from the mapping screen)
// It imports the real files through those profiles and requires the same plan as the prototype.
const raw = (g: Record<string, string>, name: string): string | undefined => Object.entries(g).find(([p]) => p.endsWith(`/${name}`))?.[1]
const files = import.meta.glob('../../reference-local/ds1-files/*.csv', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const profiles = import.meta.glob('../../reference-local/ds1-profiles/*.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const baseline = import.meta.glob('../../reference-local/ds1_baseline.json', { eager: true, import: 'default' }) as Record<string, { expected: PlanResult }>

const ready = Object.keys(files).length >= 3 && Object.keys(profiles).length >= 4 && Object.keys(baseline).length === 1
const need = (text: string | undefined, what: string): string => {
  if (text === undefined) throw new Error(`${what} is missing in reference-local/`)
  return text
}
const utf8 = (s: string) => new TextEncoder().encode(s)

describe.skipIf(!ready)('DS-1 real files through their profiles (local only)', () => {
  it('gives the prototype\'s plan', async () => {
    const site0 = parseSite(need(raw(profiles, 'site.json'), 'site.json'))
    const read = async (file: string, profile: string) => ({
      table: await readSource(utf8(need(raw(files, file), file)), file),
      profile: parseProfile(need(raw(profiles, profile), profile)),
    })
    const places = await read('places.csv', 'places.json')
    const importedPlaces = applyProfile(places.table, places.profile, site0, '2026-10-13')
    const site = extendPlaces(site0, importedPlaces.places)
    const techs = await read('technicians.csv', 'technicians.json')
    const importedTechs = applyProfile(techs.table, techs.profile, site, '2026-10-13')
    const cases = await read('cases.csv', 'cases.json')
    const importedCases = applyProfile(cases.table, cases.profile, site, '2026-10-13')
    const merged = mergeImport([], importedCases, '2026-10-13')
    const { input } = toPlanInput(extendPlaces(site, importedCases.places), merged.cases, importedTechs.technicians, {
      planStart: '2026-10-13', importDate: '2026-10-13',
    })
    const expected = Object.values(baseline)[0].expected
    expect(compareResults(plan(input), expected)).toEqual([])
  })
})
