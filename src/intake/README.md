# Data intake library

Turns any center's CSV, Excel (`.xlsx`) or JSON export into the planning engine's input. Pure TypeScript: no screens,
no storage, no network, no clock. Design: `docs/superpowers/specs/2026-11-20-data-intake-design.md`.

## The chain

```ts
import { readSource } from './read'
import { suggestProfile } from './map/suggest'
import { applyProfile } from './map/apply'
import { mergeImport } from './import/merge'
import { toPlanInput } from './import/plan-input'
import { extendPlaces } from './site/site'
import { starterSite } from './site/starter'
import { plan } from '../engine'

const site = starterSite()                                     // or parseSite(fileText)
const table = await readSource(bytes, 'cases.csv')              // detects encoding, delimiter, header row, sheet
const { profile, suggestions, needsDateOrder } = suggestProfile(table, 'cases', site)
// ...the user confirms the suggestions, the date order and the value maps (profile.valueMaps)...
const imported = applyProfile(table, profile, site, '2026-10-13')   // exceptions + quality report, unmapped columns dropped
const merged = mergeImport([], imported, '2026-10-13')              // states, import preview, change log
const { input } = toPlanInput(extendPlaces(site, imported.places), merged.cases, technicians, {
  planStart: '2026-10-13', importDate: '2026-10-13',
})
const result = plan(input)
```

Every failure caused by a file is an `IntakeError` with a code and a plain message that names the file, sheet,
column or value.

## Files

- **Mapping profile** (`map/profile.ts`): column map, value maps, detected formats. JSON, no case data.
- **Site profile** (`site/site.ts`, starter in `site/starter.ts`): work types, skills, priority levels, places,
  aliases, rule values. JSON, no case data.
- **Open data format** (`open-format.ts`, templates in `public/templates/`): files with the field names of the
  common model import with `openFormatProfile(kind)` and no mapping step.

## Limits in this release

- `.xlsx` only. An old `.xls` file gets a message asking the user to save it as `.xlsx` or CSV (the requirements
  list `.xls`; it moves to a later release).
- Places resolve from the site's own table, from coordinates, or from postal codes. There is no lookup over the
  internet.
- Customer name and address columns are personal data: suggestions never map them; a user can map them on purpose.

## Tests

`npx vitest run src/intake`. `conformance.test.ts` imports five invented data sets (different layouts, languages,
encodings, delimiters, date styles, one `.xlsx`, one JSON, with defects) and plans them. `roundtrip.test.ts` writes
invented plan inputs as open-format files and checks that the imported plan equals the original. `ds1.local.test.ts`
checks the owner's real DS-1 files and runs only when the git-ignored `reference-local/` folder holds them (layout in
the file's header comment).
