# Data intake and mapping: design

Date: 2026-11-20
Status: design approved by the project owner on 2026-11-20 (sections 1 to 3); implementation plan not yet written
Part of: AC Service Scheduler, requirements v4.1 (FR-01, FR-22, FR-23, FR-26, FR-27; sections 6.1 to 6.5),
the second of five pieces (engine, **data intake and mapping**, screens, phone/map/sharing, hardening)

## 1. Purpose

Turn any center's exports (CSV, Excel, JSON) into the planner's input, with no code change per center. A file is
read, its format detected, its columns and values mapped once through a saved profile, its places resolved from
the center's own place table, its quality reported, repeat imports merged, and the result handed to the planning
engine. This piece is a **headless library**: no screens, no storage, no network. The mapping screen, the import
preview screen and the local database belong to the screens piece, which is built on top of this tested logic.

## 2. Decisions taken with the project owner (2026-11-20)

| Question | Decision |
|---|---|
| How is this piece scoped? | Headless library first, screens later. Layers A (read and detect), B (map and clean), C (merge and hand off) are built and proven end to end with no screens. |
| How are Excel files read? | `.xlsx` through the npm package `read-excel-file`, loaded on demand. Old `.xls` files get a plain message ("save it as .xlsx or CSV") and move to a later release. This changes FR-01.1 of requirements v4.1 (which lists `.xls`); the change is recorded here and goes into the next requirements revision. Rejected: SheetJS (the npm copy is frozen at a version with a known security flaw, fixed versions are only on its own download site and are not covered by the npm audit); an own `.xlsx` reader (more work, more risk). |
| How are CSV and JSON read? | Our own small readers, tested with random round trips. Rejected: PapaParse (saves about an hour, but encoding, header row and date detection must be written anyway). |

## 3. Boundary and pipeline

Location `src/intake/`. Pure TypeScript. No React, no browser storage, no network, no clock (dates the caller needs,
such as the import date, are passed in). Safe to run in a Web Worker. The only dependency that is not our own code
is the `.xlsx` reader, loaded with a dynamic import so that it stays out of the first download (NFR budget).

Five plain functions, each from data to data:

| Function | In | Out |
|---|---|---|
| `readSource(bytes, fileName, options?)` | file bytes | `SourceTable`: header, rows, detected format, sheet list. Async (the `.xlsx` reader loads on demand). Throws `IntakeError` with a plain message when the file cannot be used. |
| `suggestProfile(table, site)` | a table | a draft `MappingProfile` with a suggestion, confidence and reason for every field, for the screen to confirm |
| `applyProfile(table, profile, site, importDate)` | a table and a confirmed profile | `Imported`: cases, technicians or places in the common model, plus `exceptions` and a `QualityReport`. Unmapped columns are dropped here and never kept. |
| `mergeImport(existing, imported, importDate)` | stored cases and a new import | the new case list with states, the `ImportPreview` counts and the change-log entries. Nothing is stored. |
| `toPlanInput(site, cases, technicians, options)` | the site profile and stored data | the planning engine's `PlanInput` |

A file holds one kind of data: cases, technicians or places. The profile says which (`kind`). A center may therefore
bring three files, as DS-1 does.

## 4. Data shapes

All are plain JSON-serialisable data. Dates are text `YYYY-MM-DD` inside this library and become engine day numbers
only in `toPlanInput` (using `dayNumber` from `src/engine/calendar.ts`).

**Common model** (requirements section 6.1; TypeScript names are camelCase, open-format file names are the snake_case
names of the requirements):

- Case: `caseId` (mandatory), `workTypeSource` (mandatory, or one work type for the whole file), location as at
  least one of `latitude` + `longitude`, `postalCode`, `area`, `address` (mandatory), and optional `status`,
  `reportedAt`, `priority`, `dueAt`, `productType`, `durationMin`, `earliestDate`, `technician`, `customerName`
  (personal), `notes`, `otherRef`.
- Technician: `name` (mandatory), `skills` (mandatory), optional `active`, `leaveFrom`, `leaveTo`, start point
  (`startArea`, or `startLatitude` + `startLongitude`), end point likewise, `shiftStart`, `shiftHours`, `breakMin`.
- Place: `area` (mandatory), `latitude` + `longitude`, optional `postalCode`, `zone`.

**`SourceTable`**: `format`, `fileName`, `sheets`, `sheet`, `headerRow`, `headers` (trimmed, unique), `rows` (cells are
text, number, date, boolean or null), and `detected` (encoding, delimiter, each with a confident flag, skipped title
rows, ragged rows, blank rows).

**`MappingProfile`** (a JSON file, no case data): `profileVersion`, `name`, `kind`, layout `fingerprint` (hash of the
normalised headers), `sheet`, `headerRow`, `formats` (encoding, delimiter, date order, decimal mark), `columns`
(field to source column names, several for a location), `valueMaps` (work type, status action, priority level,
skill), and `singleWorkType` for a file without a category column.

**`SiteProfile`** (a JSON file, no case data): `siteVersion`, `name`, `settings` (everything the engine's `Settings`
holds except the plan start day and holidays, which are passed per run), `workTypes` (name, service minutes, daily
ceiling, required skill), `skills`, `priorityLevels`, `places` and `aliases`, `keepAssignedTechnician`, and
`columnNames` (the dictionary extended by the user). The starter template holds the values validated on DS-1.

**`Exception`**: case, issue (`missing_id`, `no_location`, `unknown_work_type`, `bad_date`, `duplicate_id`), detail,
suggested action. **`QualityReport`**: rows read, blank and total rows skipped, share of rows filled per mapped field,
duplicates, unreadable dates (count and examples), unknown values per field, unresolved places, ragged rows.

## 5. Reading and detection (layer A)

- **Encoding.** A byte-order mark decides first (UTF-8, UTF-16 LE or BE). Without one, strict UTF-8 is tried; if it
  fails, Windows-1252 is used and marked **not confident**, so the screen shows a preview and lets the user pick
  another encoding (`TextDecoder` labels such as `windows-1256`, `windows-1251`, `shift_jis`, `gbk`).
- **Delimiter.** Comma, semicolon, tab or pipe: the one that gives the most consistent column count (at least two
  columns on at least 90% of the first 50 rows). Unclear is reported and the user picks. Quoted cells, doubled
  quotes and line breaks inside cells are read correctly. Ragged rows are padded or trimmed and counted.
- **Header row.** The first row with text in most columns. Title lines above it are skipped and counted. The user can
  pick another row. Duplicate header names get a suffix (` (2)`).
- **Excel.** The first sheet with data, or the sheet in the profile. Dates arrive as dates or serial numbers.
  `.xls`, and files that claim to be `.xlsx` but are not, get a plain message.
- **JSON.** A list of objects, or one object holding a list of objects (for example `{ "cases": [...] }`). Nested
  values are flattened one level with dots. Anything else is rejected with a reason.
- **Rejected files** (plain language): not a data file; empty; no column can serve as case identifier (cases).
- **Dates.** ISO 8601 (with or without time and offset, the calendar date is kept as written, no time-zone shifting),
  day-first, month-first, year-first, month names (a configurable name list, English built in) and spreadsheet
  serial numbers. The order is decided from the column: a first part above 12 means day-first, a second part above
  12 means month-first. If neither shows, the user confirms once and the choice is saved in the profile. Two-digit
  years 00 to 69 mean 2000 to 2069, 70 to 99 mean 1970 to 1999.
- **Numbers.** Decimal point or comma and thousands separators, decided from the whole column.

## 6. Mapping (layer B)

- **Suggestions.** The seed dictionary (requirements section 6.2, held as data, any language) is matched after
  normalising case, accents, punctuation and word order. A column name that matches exactly scores 1.0, a partial
  match less. Value checks add hints: a column that is all dates, numbers within latitude or longitude range,
  unique identifier-like values, low-variety text for category or status. Each suggestion has a confidence from 0
  to 1 and a reason ("matches Ticket No"). Confidence of 0.8 or more is pre-filled, lower is only offered.
  Confirmed names are saved in the profile and in `SiteProfile.columnNames`, so the dictionary grows.
- **Personal data.** Columns that usually hold it (name, phone, email, address) are marked personal and stay
  unmapped until the user chooses (requirements: privacy rules). Unmapped columns are discarded in `applyProfile`.
- **Value maps.** Distinct source values map to the site's work types, status actions (`schedule`, `hold`,
  `ignore`), priority levels and skills (several values in one cell split on `,` `;` `/` `|`, or several columns).
  Each unknown value is reported once, the case becomes **Needs review**, and the answer is saved in the profile.
- **Locations.** Valid coordinates win: one place per distinct pair rounded to 5 decimals, named after the area text
  when there is one. Otherwise the place name is looked up (normalised, through the aliases) in the site's place
  table, then the postal code. Nothing found: the case is imported and an exception `no_location` is raised. A
  location may be built from several source columns. There is no lookup over the internet.
- **Fallbacks** (BR-20): no reported date uses the import date; no priority means the lowest level; no status means
  schedulable; no duration means the work type's minutes; no active flag means active.

## 7. Merge (layer C)

- **Identity.** `caseId` trimmed, compared as text. A repeat import updates the case, never adds a second one. If
  the same identifier appears twice in a file, the first row is kept and the others are listed as duplicates.
- **States.** `active` (schedulable), `hold`, `review`, `ignored`, `done`, `closed`. Scheduled and Not scheduled are
  planner results and not stored by this library. A case missing from a later full file becomes `closed`; it
  returns to its state when it appears again. A case whose work type is unmapped is `review`.
- **User decisions survive** a later import: a manual technician or date, a work type chosen for a review case,
  and "done".
- **`ImportPreview`**: `new`, `updated`, `unchanged`, `duplicate`, `incomplete` (no usable identifier), `removed`
  (becomes closed). Counts add up to the rows read plus the cases that disappeared.
- **Change log.** One entry per change: case, field, previous value, new value, reason.

## 8. Hand-off (layer C)

`toPlanInput(site, cases, technicians, { planStart, holidays, importDate })` returns `{ input, caseIds }`.

- Work types, skills (ids = position in `site.skills`), priority levels and settings come from the site profile.
- Only `active` cases go in. `hold`, `review`, `ignored`, `done` and `closed` stay out.
- Cases are sorted by numeric identifier (text identifiers by text), because the engine never sorts.
- `reportedAt` becomes `reportedDay` (the import date when missing); `dueAt` becomes `dueDay`; `earliestDate`
  becomes `earliestDay`; `productType`, `durationMin` become `productType` and `serviceMin`; the assigned
  technician becomes `pinnedTech` only when `site.keepAssignedTechnician` is true.
- Technician start and end places, hours and leave map to the step 2 fields of `PlanInput`.

## 9. Files

- Mapping profile and site profile are JSON with a version number. Reading one that is invalid or from a newer
  version gives a plain message naming the field. A test checks that every exported profile contains no case data
  (requirements: privacy rules).
- **Open data format** (FR-27): a JSON schema, a field guide and blank CSV templates in `public/templates/`, and a
  built-in profile that maps the open names to themselves, so files in that format import with no mapping.

## 10. Files in `src/intake/`

| File | Job |
|---|---|
| `errors.ts` | `IntakeError` with a code and a plain message |
| `read/encoding.ts`, `csv.ts`, `json.ts`, `xlsx.ts`, `table.ts` | decode bytes, parse delimited text, read JSON, read `.xlsx`, build and normalise the table |
| `read/dates.ts`, `numbers.ts` | date and number detection and parsing |
| `read/index.ts` | `readSource` |
| `map/model.ts` | the common model types and field names |
| `map/dictionary.ts`, `suggest.ts` | seed dictionary and `suggestProfile` |
| `map/profile.ts` | `MappingProfile` type, fingerprint, read and write with checks |
| `map/values.ts`, `places.ts` | value maps, location resolution |
| `map/apply.ts`, `quality.ts` | `applyProfile`, the quality report and exceptions |
| `site/site.ts`, `starter.ts` | `SiteProfile` type, read and write with checks, starter template |
| `import/merge.ts`, `plan-input.ts` | `mergeImport`, `toPlanInput` |
| `open-format.ts` | open-format field list, schema and built-in profile |
| `testing/` | generators for invented conformance data sets (DS-2 to DS-6), a CSV writer, fixtures |

Tests sit next to each file. `testing/` is excluded from coverage.

## 11. Testing

- Unit tests per function, with tables of examples for dates, numbers, delimiters, encodings and headers.
- Random round trips (fast-check): any table written as CSV (with quotes, doubled quotes, line breaks, Unicode,
  empty cells) and read back is equal; any date written in a supported style is read back to the same calendar date.
- **Conformance data sets**, all invented and generated by seeded code in `testing/`: DS-2 to DS-6 with different
  layouts, column languages, encodings (UTF-16, Windows-1252), delimiters, date styles and number formats, one
  `.xlsx` and one JSON, and defects (duplicates, blank and total rows, unknown categories, missing locations,
  ambiguous dates). Each must import and plan with no code change. Column suggestions must be right for at least
  80% of the mandatory and recommended fields across them (requirements: column suggestion accuracy target).
- **Round trip to a plan.** An invented plan input (the golden scenarios) is written out as files, imported through
  profiles, converted with `toPlanInput` and planned; the plan must equal the original golden plan. The same check
  runs locally on the owner's real DS-1 files with the DS-1 profile (git-ignored `reference-local/`, skipped in the
  public pipeline and reported as skipped, never as passed).
- Profile files: a test checks that no exported profile or site template contains a case value.
- Engine and intake coverage at least 90% (statements and lines). The lint, type check and build pass.

## 12. Errors

Every failure the user can cause is an `IntakeError` with a code and a plain message that names the file, sheet,
column or value (for example `The file has no column that can serve as case identifier`). The library does not
throw on an unusual but readable file: it reports exceptions and quality problems instead and imports what it can.

## 13. Out of this piece

Screens (file picker, mapping screen with sample rows, quality report screen, import preview screen), the local
database and persistent storage, the map, geocoding over the internet, `.xls`, certifications and community profile
libraries. The screens piece uses the five functions and the three data shapes as they are.

## 14. Risks

| Risk | Mitigation |
|---|---|
| Real exports are messier than the invented sets | Five varied conformance sets with defects; the real DS-1 files are checked locally; the library reports instead of failing |
| Encoding guess is wrong on a single-byte file | The guess is marked not confident and the screen shows a preview to choose another encoding |
| Ambiguous dates (day and month) silently swapped | Order is decided from the data; when ambiguous the user confirms once, and the choice is saved in the profile |
| The `.xlsx` package changes or is abandoned | It is called from one function (`read/xlsx.ts`); replacing it touches one file |
| Personal data reaches the repository or a shared profile | Unmapped columns are discarded at import; personal columns stay unmapped by default; a test checks profile files; all test data is invented |
| `.xls` is needed sooner than expected | Planned for a later release behind the same function; the message tells the user how to convert today |

## 15. Finish line

- The five functions exist with the shapes above and are used by the round-trip test.
- All five conformance sets import and plan; suggestion accuracy is at least 80%.
- Invented golden plans survive the file round trip; the owner's real DS-1 files give an identical plan locally.
- Coverage at least 90%; pipeline green on GitHub; one pull request from branch `data-intake`.

Estimate: 10 to 14 hours of build time.
