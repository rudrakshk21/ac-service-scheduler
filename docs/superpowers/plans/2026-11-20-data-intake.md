# Data Intake and Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, no subagents: the project owner manages usage limits). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A headless TypeScript library (`src/intake/`) that turns any center's CSV, Excel or JSON export into the planning engine's input through saved mapping profiles, with a data quality report and repeat-import merging.

**Architecture:** Five plain functions (`readSource`, `suggestProfile`, `applyProfile`, `mergeImport`, `toPlanInput`) over three JSON data shapes (common model, mapping profile, site profile). Pure code, no screens, storage, network or clock. Each stage has its own tests; the whole chain is proven by importing invented conformance files and planning them.

**Tech Stack:** TypeScript 7 (strict, `erasableSyntaxOnly`, `verbatimModuleSyntax`, no parameter properties), Vitest 5 + fast-check, oxlint, `read-excel-file` (runtime, lazy-loaded), `write-excel-file` (dev only, makes `.xlsx` test files).

**Spec:** `docs/superpowers/specs/2026-11-20-data-intake-design.md` (approved 2026-11-20). Read it first; this plan implements it.

## Global Constraints

- Repo `C:\Users\lenovo\Projects\ac-service-scheduler`, branch `data-intake` (never `main`). Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Real data never enters a committed file. All test data is invented. The real DS-1 check is local only (git-ignored `reference-local/`, skipped otherwise and reported as skipped).
- Pure library: no React, no `window`/`localStorage`/`fetch`, no `Date.now()` or `new Date()` without an argument. The caller passes dates (`importDate`, `planStart`) as `YYYY-MM-DD` text.
- Dates inside the library are `YYYY-MM-DD` text; engine day numbers appear only in `plan-input.ts` (use `dayNumber` from `../engine/calendar`).
- First download budget: the `.xlsx` package is loaded with a dynamic `import()` inside `read/xlsx.ts` only.
- Plain-language errors: every failure caused by the user's file is an `IntakeError(code, message)` naming the file, sheet, column or value.
- Personal data: columns named like a customer name, phone, email or address are never mapped by suggestion (they get `personal: true`); unmapped columns never leave `applyProfile`.
- No site-specific names in code: category words, status words, place names and rule values live only in profiles, the dictionary data and test data.
- `src/intake/testing/` is excluded from coverage. Intake coverage at least 90% statements and lines (extend the Vitest `coverage.include` to `src/intake/**/*.ts` in Task 0).
- Commands: from PowerShell pass paths to npm/npx with forward slashes; in Bash use `py` for Python. Full local check (run after every task, all must pass):
  `cd /c/Users/lenovo/Projects/ac-service-scheduler && npm run lint && npx tsc -b && npm run test:coverage && py -m unittest discover -s reference -p "test_*.py" && py reference/check_ds1_local.py`
- Before using the Write tool on a path, check it does not exist (`ls`); a Write over an existing test file once replaced it.

## Shared types (defined once, used by later tasks; copy exactly)

```ts
// src/intake/errors.ts
export type IntakeErrorCode =
  | 'not_a_data_file' | 'empty_file' | 'unsupported_format' | 'no_case_id_column'
  | 'bad_profile' | 'bad_site' | 'unreadable'
export class IntakeError extends Error {
  readonly code: IntakeErrorCode
  constructor(code: IntakeErrorCode, message: string) {
    super(message)
    this.name = 'IntakeError'
    this.code = code
  }
}

// src/intake/read/table.ts
export type Cell = string | number | boolean | Date | null
export interface Detected {
  encoding: string; encodingConfident: boolean
  delimiter: string | null; delimiterConfident: boolean
  skippedTitleRows: number; raggedRows: number; blankRows: number
}
export interface SourceTable {
  format: 'csv' | 'xlsx' | 'json'
  fileName: string
  sheets: string[]; sheet: string
  headerRow: number
  headers: string[]
  rows: Cell[][]
  detected: Detected
}
export interface ReadOptions { encoding?: string; delimiter?: string; sheet?: string; headerRow?: number }

// src/intake/map/model.ts
export type Kind = 'cases' | 'technicians' | 'places'
export const CASE_FIELDS = ['caseId', 'workType', 'latitude', 'longitude', 'postalCode', 'area', 'address', 'status',
  'reportedAt', 'priority', 'dueAt', 'productType', 'durationMin', 'earliestDate', 'technician', 'customerName',
  'notes', 'otherRef'] as const
export const TECHNICIAN_FIELDS = ['name', 'skills', 'active', 'leaveFrom', 'leaveTo', 'startArea', 'startLatitude',
  'startLongitude', 'endArea', 'endLatitude', 'endLongitude', 'shiftStart', 'shiftHours', 'breakMin'] as const
export const PLACE_FIELDS = ['area', 'latitude', 'longitude', 'postalCode', 'zone'] as const
export const MANDATORY: Record<Kind, readonly string[]> = {
  cases: ['caseId', 'workType'], technicians: ['name', 'skills'], places: ['area', 'latitude', 'longitude'],
}
export const PERSONAL_FIELDS = ['customerName'] as const
export type StatusAction = 'schedule' | 'hold' | 'ignore'

// src/intake/map/profile.ts
export interface MappingProfile {
  profileVersion: 1
  name: string
  kind: Kind
  fingerprint: string
  sheet?: string
  headerRow?: number
  formats: { encoding?: string; delimiter?: string; dateOrder?: 'dmy' | 'mdy' | 'ymd'; decimal?: '.' | ',' }
  /** Field name to the source column headers that feed it (several for a location). */
  columns: Record<string, string[]>
  valueMaps: {
    workType: Record<string, string>   // normalised source value -> site work type name
    status: Record<string, StatusAction>
    priority: Record<string, string>   // normalised source value -> site priority level name
    skill: Record<string, string>      // normalised source value -> site skill name
  }
  /** Used when the file has no category column. */
  singleWorkType?: string
}

// src/intake/site/site.ts
import type { PriorityLevel, Settings, WorkType } from '../../engine/types'
export type SiteSettings = Omit<Settings, 'holidays' | 'startDay' | 'priorityLevels'>
export interface SitePlace { name: string; latitude: number; longitude: number; postalCode?: string; zone?: string }
export interface SiteProfile {
  siteVersion: 1
  name: string
  settings: SiteSettings
  workTypes: WorkType[]              // requiredSkill = index into `skills`
  skills: string[]
  priorityLevels: PriorityLevel[]    // lowest first
  places: SitePlace[]
  aliases: Record<string, string>    // normalised spelling -> place name
  keepAssignedTechnician: boolean
  columnNames: Record<string, string[]>   // field -> extra column names confirmed by users
}

// src/intake/map/apply.ts
export type CaseState = 'active' | 'hold' | 'review' | 'ignored'
export interface ImportedCase {
  caseId: string
  workType?: string; latitude?: number; longitude?: number; postalCode?: string; area?: string; address?: string
  status?: string; reportedAt?: string; priority?: string; dueAt?: string; productType?: string
  durationMin?: number; earliestDate?: string; technician?: string; customerName?: string; notes?: string; otherRef?: string
  /** Resolved: name of the place in the site's table (or a created place). Absent when unresolved. */
  place?: string
  workTypeName?: string               // mapped site work type; absent when unmapped
  priorityLevel?: string              // mapped level name
  state: CaseState
}
export interface ImportedTechnician {
  name: string; skills: string[]; active: boolean
  leaveFrom?: string; leaveTo?: string
  startPlace?: string; endPlace?: string
  shiftStart?: number; shiftHours?: number; breakMin?: number   // shiftStart in minutes after midnight
}
export type IssueCode = 'missing_id' | 'no_location' | 'unknown_work_type' | 'bad_date' | 'duplicate_id'
export interface IntakeException { caseId: string; issue: IssueCode; detail: string; suggestedAction: string }
export interface QualityReport {
  rowsRead: number; blankRowsSkipped: number; totalRowsSkipped: number; raggedRows: number
  filled: Record<string, number>          // field -> share of data rows with a value, 0..1
  duplicates: number
  badDates: { field: string; count: number; examples: string[] }[]
  unknownValues: { field: 'workType' | 'status' | 'priority' | 'skill'; values: string[] }[]
  unresolvedPlaces: number
}
export interface Imported {
  kind: Kind
  cases: ImportedCase[]
  technicians: ImportedTechnician[]
  places: SitePlace[]                      // places created from coordinates or a places file
  exceptions: IntakeException[]
  quality: QualityReport
}

// src/intake/import/merge.ts
export type StoredState = CaseState | 'done' | 'closed'
export interface Overrides { technician?: string; date?: string; workType?: string; done?: boolean }
export interface StoredCase extends Omit<ImportedCase, 'state'> {
  state: StoredState
  overrides: Overrides
  firstImported: string; lastImported: string
}
export interface ImportPreview { new: number; updated: number; unchanged: number; duplicate: number; incomplete: number; removed: number }
export interface ChangeLogEntry { caseId: string; field: string; previous: string; next: string; reason: string }
export interface MergeResult { cases: StoredCase[]; preview: ImportPreview; changes: ChangeLogEntry[] }
```

## File Structure

See section 10 of the spec. Each source file has a test file next to it (`name.test.ts`).

---

### Task 0: Set-up (dependencies, coverage, errors)

**Files:** Modify `package.json`, `vite.config.ts`; Create `src/intake/errors.ts`, `src/intake/errors.test.ts`.

- [ ] **Step 1: Install.** Run `npm install read-excel-file` and `npm install -D write-excel-file`. Read `node_modules/read-excel-file/README.md` and `package.json` `exports` to learn the entry points (browser, web worker, node) and the function signatures of the installed major version; note them as a comment at the top of `read/xlsx.ts` in Task 4. Check `npm audit --omit=dev` shows nothing new that matters.
- [ ] **Step 2: Coverage.** In `vite.config.ts` extend `coverage.include` to `['src/engine/**/*.ts', 'src/intake/**/*.ts']` and keep the `exclude` for tests and `testing/` (also `src/intake/**/testing/**`). Keep the 90% thresholds.
- [ ] **Step 3: Errors.** Create `src/intake/errors.ts` with `IntakeError` exactly as in Shared types. Test: `new IntakeError('empty_file', 'x')` is an `Error`, has `code`, `name === 'IntakeError'`, `message === 'x'`.
- [ ] **Step 4:** Full local check; commit `chore(intake): add the xlsx reader dependency, intake coverage and IntakeError`.

---

### Task 1: CSV parsing, writing, delimiter and header-row detection

**Files:** Create `src/intake/read/csv.ts`, `csv.test.ts`, `table.ts`, `table.test.ts`.

**Interfaces:** `parseCsv(text, delimiter): string[][]`; `serializeCsv(rows, delimiter): string`; `detectDelimiter(text): { delimiter: string; confident: boolean }`; in `table.ts` the `Cell`, `Detected`, `SourceTable`, `ReadOptions` types and `buildTable(rows: Cell[][], meta: { format; fileName; sheets; sheet; encoding; encodingConfident; delimiter; delimiterConfident }, options: ReadOptions): SourceTable`.

- [ ] **Step 1: Failing tests (`csv.test.ts`).**
  - `parseCsv('a,b\n1,2\n', ',')` equals `[['a','b'],['1','2']]` (a trailing newline adds no row); same with `\r\n` and with `\r`.
  - Quotes: `'"a,b","c""d"\n'` gives `[['a,b','c"d']]`; a quoted cell with a line break inside is one cell; an empty line gives a row `['']`.
  - A quote inside an unquoted cell is kept literally: `'ab"c,d\n'` gives `[['ab"c','d']]`.
  - `serializeCsv([['a,b','c"d','e\nf','']], ',')` is `'"a,b","c""d","e\nf",\n'` and always ends with a newline.
  - Property (fast-check): for random rows of strings built from an alphabet including `,` `;` `"` `\n` `\r` space `é` `日` and the empty string, with delimiter in `, ; \t |`, `parseCsv(serializeCsv(rows, d), d)` equals `rows` (use `fc.array(fc.array(fc.string(...)))`; exclude the case of zero rows).
  - `detectDelimiter`: comma file; semicolon file whose cells contain decimal commas (`'id;x\n1;2,5\n2;3,5\n'`); tab file; pipe file; a file with a title line then a comma table; a single-column file returns `{ delimiter: ',', confident: false }`; a file where comma and semicolon both appear inconsistently returns `confident: false`.
- [ ] **Step 2: Implement `csv.ts`.** Parser (a state machine, copy exactly):

```ts
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let started = false
  let i = 0
  const n = text.length
  while (i < n) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue }
        quoted = false
        i += 1
        continue
      }
      cell += ch
      i += 1
      continue
    }
    if (ch === '"' && cell === '') { quoted = true; started = true; i += 1; continue }
    if (ch === delimiter) { row.push(cell); cell = ''; started = true; i += 1; continue }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      i += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      started = false
      continue
    }
    cell += ch
    started = true
    i += 1
  }
  if (started || cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}
```

  `serializeCsv`: quote a cell when it contains the delimiter, `"`, `\n` or `\r`, doubling `"`; join cells with the delimiter and rows with `\n`; end with `\n`. `detectDelimiter`: take `text.slice(0, 65536)`; for each candidate in `, ; \t |` parse with it and (if the text was cut) drop the last row; `counts` = column counts of the first 50 rows; `modal` = most common count; `score = modal >= 2 ? sharedRows / rows : 0`. Choose the highest score; on a tie in score choose the candidate with the larger `modal`; `confident = best.score >= 0.9 && (second.score < 0.9 || best.modal > second.modal)`. When every score is 0 return `{ delimiter: ',', confident: false }`.
- [ ] **Step 3: Failing tests (`table.test.ts`)** for `buildTable`:
  - Header row detection: rows `[['Report title'], [''], ['Id','Area','Date'], ['1','A','2026-01-01']]` give `headerRow: 2`, `skippedTitleRows: 2`, headers `['Id','Area','Date']`, one data row. Rule: the header is the first row where the count of non-empty cells is at least `ceil(0.6 * width)` (width = the largest non-empty cell count among the first 30 rows) and every non-empty cell is a string.
  - `options.headerRow` overrides the detection.
  - Headers are trimmed; empty header names become `Column 3` (1-based position); duplicates get ` (2)`, ` (3)`.
  - Blank rows (every cell empty or whitespace) are removed and counted in `detected.blankRows`.
  - Ragged rows are padded with `null` or trimmed to `headers.length` and counted in `detected.raggedRows`.
  - Cells that are strings are trimmed; empty strings become `null`.
  - A table with no data rows throws `IntakeError('empty_file', ...)` naming the file.
- [ ] **Step 3b: Implement `table.ts`** as specified.
- [ ] **Step 4:** Run `npx vitest run src/intake/read`, then the full local check; commit `feat(intake): CSV reading and writing, delimiter and header detection`.

---

### Task 2: Encoding detection

**Files:** Create `src/intake/read/encoding.ts`, `encoding.test.ts`.

**Interface:** `decodeBytes(bytes: Uint8Array, requested?: string): { text: string; encoding: string; confident: boolean }`.

- [ ] **Step 1: Failing tests.**
  - UTF-8 with BOM (`EF BB BF`) decodes without the BOM, `encoding: 'utf-8'`, confident.
  - UTF-16 LE BOM (`FF FE`) and UTF-16 BE BOM (`FE FF`) decode correctly, confident.
  - UTF-8 without BOM containing `é日` decodes, confident. Plain ASCII is `utf-8`, confident.
  - Bytes that are invalid UTF-8 (`0xE9` for `é` in Windows-1252) decode as `windows-1252` with `confident: false`.
  - `requested: 'windows-1251'` forces that encoding and is confident (the user chose it).
  - A requested encoding name the runtime does not know throws `IntakeError('unreadable', ...)` naming it.
- [ ] **Step 2: Implement.** BOM first (strip it). Otherwise `new TextDecoder('utf-8', { fatal: true })`; on failure decode with `new TextDecoder('windows-1252')` and set `confident: false`. `requested` goes straight to `new TextDecoder(requested)` inside try/catch.
- [ ] **Step 3:** Full local check; commit `feat(intake): encoding detection`.

---

### Task 3: Dates and numbers

**Files:** Create `src/intake/read/dates.ts`, `dates.test.ts`, `numbers.ts`, `numbers.test.ts`.

**Interfaces:**
```ts
export type DateOrder = 'dmy' | 'mdy' | 'ymd'
export function detectDateOrder(values: string[]): { order: DateOrder | null; ambiguous: boolean }
export function parseDate(value: Cell, order: DateOrder | null): string | null   // 'YYYY-MM-DD'
export function serialToIso(serial: number): string                            // Excel 1900 date system
export type Decimal = '.' | ','
export function detectDecimal(values: string[]): Decimal | null
export function parseNumber(value: Cell, decimal: Decimal): number | null
```

- [ ] **Step 1: Failing tests (dates).**
  - `parseDate('2026-10-13', null)` and `'2026-10-13T08:30:00Z'` and `'2026-10-13 08:30:00+05:30'` give `'2026-10-13'` (the calendar date as written, no shifting).
  - With order `'dmy'`: `'13/10/2026'`, `'13-10-2026'`, `'13.10.2026'`, `'13/10/26'` (two-digit year 26 gives 2026; 70 gives 1970) all give `'2026-10-13'`. With `'mdy'`: `'10/13/2026'` gives `'2026-10-13'`. With `'ymd'`: `'2026/10/13'` gives `'2026-10-13'`.
  - Month names: `'13 Oct 2026'`, `'13 October 2026'`, `'Oct 13, 2026'`, `'13-Oct-26'` give `'2026-10-13'` whatever the order.
  - A `Date` cell gives its `YYYY-MM-DD` using the UTC parts (`getUTCFullYear` etc.); a number cell between 20000 and 80000 is an Excel serial: `serialToIso(46308)` is `'2026-10-13'` (check: serial 25569 = 1970-01-01).
  - Invalid dates (`'31/02/2026'`, `'2026-13-01'`, `'hello'`, `''`) give `null`.
  - `detectDateOrder(['13/10/2026','01/02/2026'])` is `{ order: 'dmy', ambiguous: false }`; `['10/13/2026','01/02/2026']` is `mdy`; `['01/02/2026','03/04/2026']` is `{ order: null, ambiguous: true }`; `['2026-10-13']` is `{ order: 'ymd', ambiguous: false }`; a column of ISO dates with times is `ymd`.
  - Property: for random valid calendar dates and each style, formatting in that style and parsing with the matching order returns the same date.
- [ ] **Step 2: Implement `dates.ts`.** `parseDate` rules in order: `Date` instance; finite number in `[20000, 80000]` is a serial (`serialToIso`: days since 1899-12-30, computed with integer arithmetic on day numbers, not `Date` parsing of text); string trimmed; ISO regex `^(\d{4})-(\d{1,2})-(\d{1,2})` first; then `^(\d{4})[/.](\d{1,2})[/.](\d{1,2})` as year-first; then three numeric parts split on `/`, `-`, `.` with the day and month by `order` (null order and an ambiguous pair returns `null`; a pair where one part is above 12 is decided by that part); then month-name forms (English month names and 3-letter abbreviations, case-insensitive; the name list lives in an exported `MONTHS` constant so other languages can be added as data). Validate the calendar date (days per month, leap years) and return `YYYY-MM-DD` zero-padded. Two-digit years: 00 to 69 mean 2000 to 2069, 70 to 99 mean 1970 to 1999. `detectDateOrder`: for the first 200 non-empty values that match the three-numeric-part form, if any first part is above 12 then `dmy`, else if any second part is above 12 then `mdy`; both seen means `{ order: null, ambiguous: true }`; none above 12 means `{ order: null, ambiguous: true }`; year-first values give `ymd`.
- [ ] **Step 3: Failing tests (numbers).** `parseNumber('1,234.56', '.')` is `1234.56`; `parseNumber('1.234,56', ',')` is `1234.56`; `parseNumber('2,5', ',')` is `2.5`; `parseNumber(' 7 ', '.')` is `7`; a number cell passes through; `''`, `'abc'` give `null`. `detectDecimal(['2,5','10,75'])` is `','`; `['2.5','10.75']` is `'.'`; `['1,234','5,678']` is `null` (could be thousands, ambiguous); `['1.234,5']` is `','`; `['1,234.5']` is `'.'`; integers only is `'.'`.
- [ ] **Step 4: Implement `numbers.ts`** (strip spaces and non-breaking spaces; if decimal is `','` remove `.` then replace `,` with `.`; if `'.'` remove `,`; reject anything that is not then `^-?\d+(\.\d+)?$`).
- [ ] **Step 5:** Full local check; commit `feat(intake): date and number detection and parsing`.

---

### Task 4: JSON, `.xlsx` and `readSource`

**Files:** Create `src/intake/read/json.ts`, `json.test.ts`, `xlsx.ts`, `xlsx.test.ts`, `index.ts`, `index.test.ts`.

**Interfaces:** `jsonToRows(text: string, fileName: string): Cell[][]` (first row headers); `readXlsx(bytes: Uint8Array, fileName: string, sheet?: string): Promise<{ sheets: string[]; sheet: string; rows: Cell[][] }>`; `readSource(bytes: Uint8Array, fileName: string, options?: ReadOptions): Promise<SourceTable>`.

- [ ] **Step 1: Failing tests (`json.test.ts`).** A list of objects gives headers in first-seen key order across all objects and `null` for missing keys; an object `{ "cases": [ ... ] }` (the first key whose value is a list of objects) is accepted; nested objects flatten one level with dots (`{a:{b:1}}` gives column `a.b`); arrays inside cells become `;`-joined text; invalid JSON throws `IntakeError('not_a_data_file', ...)` with the file name; `[]` throws `empty_file`; a JSON value that is a plain object without any list throws `not_a_data_file`.
- [ ] **Step 2: Implement `json.ts`.**
- [ ] **Step 3: `.xlsx` wrapper.** In `xlsx.ts` call the installed package behind `readXlsx`, using a dynamic `import()` selected so that the browser build gets the browser entry and Vitest (Node) gets an entry that works without a DOM (read the package README from Task 0; if the Node entry is needed, select it with `import.meta.env.MODE === 'test'` so the production build drops that branch). Return every sheet name; the chosen sheet is the requested one or the first with at least one non-empty row. Return rows as `Cell[][]` keeping dates as `Date` and numbers as numbers. Files that are not valid `.xlsx` (including old `.xls`, detected by the OLE signature `D0 CF 11 E0` at the start) throw `IntakeError('unsupported_format', ...)`: for `.xls` the message is `<file> is an old Excel (.xls) file. Open it in Excel and save it as .xlsx or CSV, then import again.`
- [ ] **Step 4: Failing tests (`xlsx.test.ts`).** Build real files in the test with `write-excel-file` (dev dependency; read its README for the API): one sheet with a title line, headers, rows with text, numbers and a date; a two-sheet workbook (default sheet is the first with data; `sheet: 'Second'` selects the other); the `.xls` signature bytes throw the message above; random bytes throw `unsupported_format`.
- [ ] **Step 5: `readSource`.** Decide the format from the file extension and the first bytes: `.xlsx` or the ZIP signature `PK` goes to `readXlsx`; `.json` or a first non-space character `[` or `{` goes to `jsonToRows`; the OLE signature throws as above; everything else is delimited text: `decodeBytes(bytes, options.encoding)`, `detectDelimiter` (or `options.delimiter`), `parseCsv`, then `buildTable` for all formats. `meta.delimiter` is `null` for xlsx and json.
- [ ] **Step 6: Failing tests (`index.test.ts`).** UTF-8 CSV with BOM and a title line; semicolon CSV in Windows-1252 bytes (`not confident`, then the same bytes with `options.encoding: 'windows-1252'` is confident); UTF-16 LE tab file; JSON; an `.xlsx`; each gives the same headers and row count as the equivalent CSV. A text file with no table (`'just some words'`) throws `not_a_data_file`; empty bytes throw `empty_file`.
- [ ] **Step 7:** Full local check; commit `feat(intake): JSON and xlsx readers and readSource`.

---

### Task 5: Common model, seed dictionary and column suggestions

**Files:** Create `src/intake/map/model.ts`, `model.test.ts`, `dictionary.ts`, `suggest.ts`, `suggest.test.ts`.

**Interfaces:** the constants and types of Shared types in `model.ts` plus `normaliseName(text: string): string` (lower-case, strip accents with `normalize('NFD')` and remove combining marks, replace non-alphanumerics with single spaces, trim) and `openName(field: string): string` (camelCase to snake_case: `caseId` to `case_id`). `dictionary.ts`: `SEED_DICTIONARY: Record<Kind, Record<string, string[]>>` (field to example column names, requirements section 6.2, English, as data) and `PERSONAL_NAMES: string[]` (column names that usually hold personal data: customer name, contact, phone, mobile, email, address of the customer). `suggest.ts`:

```ts
export interface Suggestion { field: string; columns: string[]; confidence: number; reason: string; personal: boolean }
export interface SuggestResult { profile: MappingProfile; suggestions: Suggestion[]; unmatchedColumns: string[] }
export function suggestProfile(table: SourceTable, kind: Kind, site: SiteProfile | null, name?: string): SuggestResult
```

- [ ] **Step 1: Failing tests (`model.test.ts`).** `normaliseName('  Ticket_No.  ')` is `'ticket no'`; `normaliseName('Désignation')` is `'designation'`; `openName('postalCode')` is `'postal_code'`; every field in `CASE_FIELDS`, `TECHNICIAN_FIELDS`, `PLACE_FIELDS` has an `openName` made of lower-case letters and underscores.
- [ ] **Step 2: Dictionary data.** For cases use the names of requirements section 6.2: caseId (Display ID, Case ID, Ticket ID, Ticket No, Work Order, Job No, Service Request, SR Number, Complaint No, Call ID); workType (Category, Category Level 1, Call Type, Service Type, Job Type, Work Type, Nature of Complaint, Request Type); status (Status, Stage, State, Case Status, Call Status); reportedAt (Reported on, Created On, Created Date, Call Date, Logged On, Registration Date, Opened At); priority (Priority, Escalation Status, Urgency, Severity); dueAt (Due Date, SLA Date, Target Date, Commitment Date); area (Location, Area, Locality, City, Town); postalCode (PIN Code, Postal Code, Zip); address (Address); latitude (Latitude, Lat); longitude (Longitude, Lng, Lon, Long); productType (Product Type, Product, Model, Equipment, Unit Type); duration (Duration, Duration Min, Minutes); earliestDate (Earliest Date, Not Before, Available From); technician (Technician, Engineer, Assigned To); notes (Notes, Subject, Remarks, Description); customerName (Customer, Customer Name, Contact Name); otherRef (Reference, Other Ref). For technicians: name (Name, Technician, Engineer, Executive, Employee, Staff), skills (Work, Skill, Skills, Trade, Specialisation, Role), active, leaveFrom/leaveTo, start/end area and coordinates, shift fields. For places: area (Place, Area, Locality, Name), latitude, longitude, postalCode, zone. Every field also accepts its own open-format name (`case_id`, `postal_code`, ...) and its camelCase name.
- [ ] **Step 3: Failing tests (`suggest.test.ts`).**
  - Headers `['Ticket No','Created On','Category','Locality','Status']` for kind cases give caseId `Ticket No` (1.0), reportedAt `Created On`, workType `Category`, area `Locality`, status `Status`, each `confidence >= 0.8`, each with a `reason` containing the matched name.
  - Value hints: an unnamed column `['x1','x2']` whose values are all dates and whose header is `Opened` is suggested as a date field with `confidence < 0.8` and a reason mentioning dates; a column `Col A` of unique 6-digit numbers is offered for `caseId` at `< 0.8`; columns named `Lat` and `Lng` with values in range map to latitude and longitude.
  - A column `Customer Name` gets a suggestion with `personal: true` and is **not** put in `profile.columns`; same for `Phone`.
  - Normalisation: `'TICKET-NO'`, `' ticket no '`, `'Ticket_No'` all match.
  - Extra names from `site.columnNames` are used (`{ caseId: ['Docket'] }` makes `Docket` match at 1.0).
  - `profile.fingerprint` equals `fingerprintOf(table.headers)` (Task 6; until then compute with the helper exported from `profile.ts` stub); `profile.formats` has the table's detected encoding and delimiter, the detected date order and decimal (from the columns mapped to date and number fields), `profile.kind` is the kind.
  - Accuracy: over the five conformance sets (Task 12) at least 80% of mandatory and recommended fields are suggested right (this assertion lives in Task 12).
- [ ] **Step 4: Implement `suggest.ts`.** For each field in the kind's field list: score each column: exact normalised match with a dictionary or site name is 1.0; a column whose normalised tokens are a subset or superset of a dictionary name's tokens is 0.7 to 0.9 by overlap ratio; value hints add or set a floor of 0.5 (dates: at least 60% of the first 100 non-empty values parse with `parseDate`, the field being one of the date fields chosen by name affinity, else `reportedAt`; latitude: numbers in -90..90 with a decimal part; longitude: -180..180; caseId: unique non-empty values across all rows and 3 to 20 characters). Assign greedily from the highest confidence, one column per field and one field per column, except location where `area`, `postalCode`, `address` may each take their best column. Columns named in `PERSONAL_NAMES` (by normalised match) produce a `personal: true` suggestion for `customerName` (or are listed unmatched for technicians) and are never put in `columns`. `unmatchedColumns` lists headers not used. Build the draft profile: `columns` from suggestions with `confidence >= 0.8`, `formats` from the table and detection (`detectDateOrder` over the values of the mapped date columns, `detectDecimal` over numeric columns), `valueMaps` empty, name `name ?? table.fileName`.
- [ ] **Step 5:** Full local check; commit `feat(intake): common model, seed dictionary and column suggestions`.

---

### Task 6: Profile and site files

**Files:** Create `src/intake/map/profile.ts`, `profile.test.ts`, `src/intake/site/site.ts`, `site.test.ts`, `starter.ts`, `starter.test.ts`.

**Interfaces:** in `profile.ts`: `fingerprintOf(headers: string[]): string` (FNV-1a 32-bit hash of the normalised headers joined by `|`, as 8 hex digits), `serializeProfile(p: MappingProfile): string` (pretty JSON), `parseProfile(text: string): MappingProfile` (throws `IntakeError('bad_profile', ...)` with the field path). In `site.ts`: `serializeSite`, `parseSite` (throws `bad_site`), `extendPlaces(site: SiteProfile, places: SitePlace[]): SiteProfile` (appends places whose name is not present, case-insensitively, without mutating). In `starter.ts`: `starterSite(): SiteProfile`.

- [ ] **Step 1: Failing tests.**
  - `fingerprintOf` is stable, ignores case, accents and surrounding space, and differs when a header is added or reordered.
  - `parseProfile(serializeProfile(p))` equals `p` for a full profile; missing `profileVersion`, wrong `kind`, `columns` values that are not lists of text, a `valueMaps.status` entry that is not `schedule|hold|ignore`, and a version above 1 each throw with a message naming the field (for example `Mapping profile: valueMaps.status["pending"] must be schedule, hold or ignore`).
  - `parseSite` round trips the starter; rejects negative service minutes, an empty skills list, a work type whose `requiredSkill` is not an index into `skills`, a priority level without a name, a place with latitude outside -90..90, and an alias that points to an unknown place.
  - `extendPlaces` adds new places once, ignores names already present (any case), and does not mutate its input.
  - `starterSite()` holds three work types (Installation 120 minutes ceiling 3, Service 75 ceiling 5, Breakdown 75 ceiling 5, required skills 0, 1, 2), skills `Installation`, `Service`, `Breakdown`, the two default priority levels, settings equal to `testSettings()` in `src/engine/testing/fixtures.ts` without `holidays`, `startDay` and `priorityLevels` (speed 30, road factor 1.35, hop 10, usable 480, day start 540, lunch 780, break 60, age weight 4, balance weight 0.05, max km 60, horizon 30, rest day Sunday), no places, `keepAssignedTechnician: true`. These are the values validated on DS-1; the test asserts them.
  - **No case data in files:** a test builds a `MappingProfile` and a `SiteProfile` from an import of an invented file whose cells contain the marker `ZZ-CASE-VALUE-9` and asserts that neither serialised string contains the marker (value maps hold category words only; they must contain none of the case identifiers; the test uses identifiers like `ZZ-CASE-VALUE-9` and category `Splits`).
- [ ] **Step 2: Implement** with hand-written validators in the style of `src/engine/check.ts` (`needText`, `needNum`, `needInt`, path-named messages).
- [ ] **Step 3:** Full local check; commit `feat(intake): mapping profile and site profile files with validation`.

---

### Task 7: Value maps and place resolution

**Files:** Create `src/intake/map/values.ts`, `values.test.ts`, `places.ts`, `places.test.ts`.

**Interfaces:**
```ts
export function normaliseValue(text: string): string   // same as normaliseName
export function splitList(value: string): string[]      // split on , ; / | and newlines, trimmed, empties dropped
export function mapWorkType(profile: MappingProfile, site: SiteProfile, source: string | undefined): { name: string | null; unknown: string | null }
export function mapStatus(profile: MappingProfile, source: string | undefined): { action: StatusAction; unknown: string | null }
export function mapPriority(profile: MappingProfile, site: SiteProfile, source: string | undefined): { level: string | null; unknown: string | null }
export function mapSkills(profile: MappingProfile, site: SiteProfile, source: string | string[]): { skills: string[]; unknown: string[] }
export interface Resolved { place: string | null; created: SitePlace | null }
export function resolveLocation(loc: { latitude?: number; longitude?: number; postalCode?: string; area?: string; address?: string }, site: SiteProfile, created: Map<string, SitePlace>): Resolved
```

- [ ] **Step 1: Failing tests (`values.test.ts`).** Work type: a source value present (normalised) in `valueMaps.workType` gives its site work type name; a value equal to a site work type name (normalised) maps to itself without an entry; an absent value with `singleWorkType` gives that; otherwise `{ name: null, unknown: <the source value> }` (empty source with no `singleWorkType` is unknown with the text `(empty)`). Status: mapped value gives its action; unmapped gives `schedule` with `unknown` set; absent source gives `schedule` with no unknown. Priority: mapped value gives its level; a value equal to a level name maps to itself; absent gives `null` level and no unknown; unmapped value gives `null` level and `unknown`. Skills: `'AC install, Split service'` with a map for both gives both skill names in order without duplicates; one unknown piece goes to `unknown`; an array input (several columns) is flattened first.
- [ ] **Step 2: Failing tests (`places.test.ts`).** Site with places `North Town (lat 20.10, lon 30.05, postal 111111)`, `South Bay (19.95, 30.10, postal 222222)` and alias `'n town' -> 'North Town'`: coordinates inside valid range win (a pair equal to North Town's within 5 decimals returns `North Town`, nothing created; a new pair creates a place named after `area` when given else `19.12345, 30.54321`, is added to `created` once and reused for the same pair); an `area` of `' north  TOWN '` resolves by normalised name; `'N Town'` resolves through the alias; `postalCode: '222222'` resolves to South Bay; coordinates with only one of the pair, out of range, or `NaN` are ignored and the next rule is tried; nothing found gives `{ place: null, created: null }`; the order is coordinates, area, alias, postal code, address text (normalised address equal to a place name or alias).
- [ ] **Step 3: Implement.** Keys are `normaliseValue`. Coordinate key `lat.toFixed(5) + ',' + lon.toFixed(5)`; a created place's `name` is the trimmed `area` or that key text. `resolveLocation` never mutates `site`.
- [ ] **Step 4:** Full local check; commit `feat(intake): value maps and place resolution`.

---

### Task 8: applyProfile and the quality report

**Files:** Create `src/intake/map/apply.ts`, `apply.test.ts`, `quality.ts`, `quality.test.ts`.

**Interface:** `applyProfile(table: SourceTable, profile: MappingProfile, site: SiteProfile, importDate: string): Imported` (types in Shared types).

- [ ] **Step 1: Failing tests (cases).** Use a small invented table (headers `Ticket No, Created On, Category, Locality, Status, Priority, Due, Product, Notes, Customer Name, Internal Memo`) and a profile mapping every column except `Customer Name` and `Internal Memo`:
  - Output cases carry only mapped fields; no property of any case contains the text of the `Customer Name` or `Internal Memo` cells (assert by `JSON.stringify` of the output).
  - `reportedAt` and `dueAt` are `YYYY-MM-DD` using the profile's `dateOrder`; a bad date becomes absent, adds an exception `bad_date` with the case id and the value, and a `badDates` entry in the quality report; a missing `reportedAt` column gives `reportedAt = importDate`.
  - Work type mapped through `valueMaps.workType` gives `workTypeName`; an unknown value gives `state: 'review'`, an exception `unknown_work_type`, and `unknownValues` with the value listed once however many rows share it.
  - Status `hold` words give `state: 'hold'`; `ignore` gives `'ignored'`; unknown status values are `schedule` and listed in `unknownValues`.
  - Priority maps to `priorityLevel`; absent column leaves it undefined.
  - Location from `Locality` resolves through the site's place table; unresolved gives `place` undefined and an exception `no_location`, still `state: 'active'` (the case is imported); coordinates columns create places in `Imported.places`.
  - A row with an empty case id is skipped and counted: exception `missing_id` (case id text `(row N)`), `quality.totalRowsSkipped` counts rows whose first mapped cells look like totals (a row whose case id cell matches `^(total|grand total|sum)\b` case-insensitively) and not `missing_id`.
  - Duplicate identifiers: the first row is kept, later rows add an exception `duplicate_id` and `quality.duplicates`.
  - `quality.filled` has, per mapped field, the share of kept rows with a value; `rowsRead` equals the table's data rows.
  - Identifiers are trimmed text (a numeric cell `100001` becomes `'100001'`; `100001.0` becomes `'100001'`).
  - `durationMin` parses numbers with the profile's `decimal`; `'45'` gives 45.
- [ ] **Step 2: Failing tests (technicians and places).** Technician file with `Name, Work, Active, Leave From, Leave To, Start Area, Shift Start, Shift Hours, Break` : skills in one cell `'Installation, Service'` and in several columns (profile `columns.skills` has two headers) both give skill names via `valueMaps.skill`; unknown skill words are listed in `unknownValues` field `skill`; `active` accepts `yes/no/y/n/true/false/1/0` (case-insensitive; other text is active and noted nowhere); leave dates parse; `shiftStart` accepts `'08:30'`, `'8.30'`, `'8:30 AM'`, `'0.354'` (an Excel day fraction) and gives minutes after midnight (510); `shiftHours` and `breakMin` are numbers; `startArea` resolves through the place table (unresolved start places are dropped with an exception `no_location` whose case id is the technician name). A places file gives `Imported.places` (area, coordinates, postal code, zone) and unresolvable coordinates (missing or out of range) are skipped with `no_location` exceptions.
- [ ] **Step 3: Implement.** Process rows in order. Cell to text: strings trimmed; numbers by `String` with a trailing `.0` removed (integers only); `Date` by `parseDate`; booleans as `'true'/'false'`. Mapped fields come from `profile.columns[field]`: for text fields the first non-empty value among the listed columns; for `skills` all listed columns' values joined; for locations each of `latitude`, `longitude`, `postalCode`, `area`, `address` independently. Numbers by `parseNumber(value, profile.formats.decimal ?? '.')`. Dates by `parseDate(value, profile.formats.dateOrder ?? null)`. Never copy unmapped columns. `quality.ts` holds the accumulator helpers (`newQuality`, `markFilled`, `finishQuality`) so that `apply.ts` stays readable.
- [ ] **Step 4:** Full local check; commit `feat(intake): applyProfile with exceptions and data quality report`.

---

### Task 9: mergeImport

**Files:** Create `src/intake/import/merge.ts`, `merge.test.ts`.

**Interface:** `mergeImport(existing: StoredCase[], imported: Imported, importDate: string, options?: { fullExport?: boolean }): MergeResult` (`fullExport` defaults to true).

- [ ] **Step 1: Failing tests.**
  - First import into `[]`: every imported case is stored with `firstImported = lastImported = importDate`, empty `overrides`, same state; `preview.new` equals the count; `changes` is empty.
  - Repeat import of identical data: `unchanged` equals the count, nothing else changes, `lastImported` becomes the new date, `firstImported` stays.
  - Changed field (`dueAt`, `area`, `status` ...): `updated` counts the case once; one change-log entry per changed field with `previous`, `next` (text) and `reason: 'import'`; the state follows the new import.
  - A case that is in `existing` but not in a full export becomes `closed` (`removed` counts it) with a change entry `state: <old> -> closed` and reason `missing from import`; with `fullExport: false` it is untouched. A closed case that reappears returns to its imported state (counted as `updated`, change entry `closed -> <state>`).
  - Overrides survive: an existing case with `overrides: { technician: 'T1', date: '2026-10-14', workType: 'Service', done: true }` keeps all four after a re-import; with `done: true` the state stays `done` even if the import says `active`.
  - A work type override on a case that the import marks `review` makes it `active` and sets `workTypeName` from the override.
  - Duplicates: `imported.exceptions` entries with issue `duplicate_id` count in `preview.duplicate` (one per exception); `missing_id` exceptions count in `preview.incomplete`.
  - Counts: `new + updated + unchanged + duplicate + incomplete` equals `imported.cases.length` plus duplicate and incomplete exceptions; `removed` is separate.
  - Pure: inputs are not mutated.
- [ ] **Step 2: Implement.** Index existing by `caseId`. For each imported case compare the tracked fields (`workType`, place fields, `status`, `reportedAt`, `priority`, `dueAt`, `productType`, `durationMin`, `earliestDate`, `technician`, `notes`, `otherRef`, `place`, `workTypeName`, `priorityLevel`, `state`) as text. `customerName` is carried only when present. State of a stored case: `done` wins when `overrides.done`; else the imported state, except `review` becomes `active` when `overrides.workType` is set. Return cases in existing order, then new cases in import order.
- [ ] **Step 3:** Full local check; commit `feat(intake): mergeImport with states, preview and change log`.

---

### Task 10: toPlanInput

**Files:** Create `src/intake/import/plan-input.ts`, `plan-input.test.ts`.

**Interface:**
```ts
export interface PlanOptions { planStart: string; holidays?: string[]; importDate: string }
export function toPlanInput(site: SiteProfile, cases: StoredCase[], technicians: ImportedTechnician[], options: PlanOptions): { input: PlanInput; caseIds: string[] }
```

- [ ] **Step 1: Failing tests.**
  - Only `active` cases are included; `hold`, `review`, `ignored`, `done`, `closed` are not. A case with no resolved `place` or no `workTypeName` is not included either (it is in the exception queue).
  - Cases are ordered by numeric identifier when both identifiers are all digits, otherwise by text, numeric before text; the engine's input order equals `caseIds`.
  - Mapping: `workType` is the index of `workTypeName` in `site.workTypes`; `place` is the index in the output place list (site places, in order, plus none others); `reportedDay` from `reportedAt` (the import date when absent) via `dayNumber`; `dueDay`, `earliestDay` from `dueAt`, `earliestDate`; `priority` is the index of `priorityLevel` in `site.priorityLevels` when present; `productType` is omitted (no product list in the site profile in this release) and `durationMin` becomes `serviceMin`; `pinnedTech` is the technician index of `technician` (or of `overrides.technician`) only when `site.keepAssignedTechnician` is true and the name matches a technician (case-insensitive); `earliestDay` from `overrides.date`.
  - Technicians: `skills` are indexes in `site.skills`; unknown skill names are dropped; `startPlace`/`endPlace` indexes in the place list (unknown names dropped); `leaveFrom`/`leaveTo` day numbers; `dayStartMin` from `shiftStart`; `usableMin` = `shiftHours * 60 - breakMin` when `shiftHours` is given (break from the technician, else the site's); `breakMin` as given.
  - Settings: copied from `site.settings`, plus `startDay` from `planStart`, `holidays` converted to day numbers, and `priorityLevels` from the site.
  - **The plan runs:** `plan(input)` from `src/engine` succeeds on the output (no `Invalid planning input` error) for the starter site and a hand-made small case list.
- [ ] **Step 2: Implement.** Use `dayNumber` from `../../engine/calendar`; keep a `Map<string, number>` for places, technicians, work types, skills (normalised keys).
- [ ] **Step 3:** Full local check; commit `feat(intake): toPlanInput hands imported cases to the planning engine`.

---

### Task 11: Open data format

**Files:** Create `src/intake/open-format.ts`, `open-format.test.ts`, `public/templates/cases.csv`, `technicians.csv`, `places.csv`, `public/templates/open-format.schema.json`.

**Interfaces:** `openFormatProfile(kind: Kind): MappingProfile` (every field mapped to its `openName`; `formats.dateOrder: 'ymd'`, decimal `'.'`; value maps empty), `isOpenFormat(headers: string[], kind: Kind): boolean` (true when every mandatory open name is present and at least 60% of the headers are open names), `openFormatSchema(): object` (JSON Schema, draft 2020-12, with a `cases`, `technicians` and `places` list, each with the fields, types and mandatory flags of requirements section 6.1), `templateCsv(kind: Kind): string` (header row only, in the order of the model).

- [ ] **Step 1: Failing tests.** `openFormatProfile('cases').columns.caseId` is `['case_id']`; `isOpenFormat(['case_id','work_type','area'], 'cases')` is true and `isOpenFormat(['Ticket No','Category'], 'cases')` is false; `templateCsv('cases')` starts with `case_id,work_type,latitude,longitude,postal_code,area,address,status,reported_at,priority,due_at,product_type,duration_min,earliest_date,technician,customer_name,notes,other_ref` and ends with a newline; the committed files in `public/templates/` equal what the functions produce (read them with `import.meta.glob(..., { as: 'raw', eager: true })`); the schema lists every field of the model exactly once per entity and marks the mandatory ones `required`.
- [ ] **Step 2: Implement** and write the three template files and the schema file from the functions (generate once with a small throw-away script in the scratchpad or a test with an env flag; commit the outputs).
- [ ] **Step 3:** In `suggestProfile` (Task 5) nothing changes: the open names are already in the dictionary. Add a test here that `suggestProfile` on an open-format table maps every field with confidence 1.0.
- [ ] **Step 4:** Full local check; commit `feat(intake): open data format schema, templates and built-in profile`.

---

### Task 12: Conformance data sets and end-to-end proofs

**Files:** Create `src/intake/testing/datasets.ts`, `src/intake/testing/roundtrip.ts`, `src/intake/conformance.test.ts`, `src/intake/roundtrip.test.ts`, `src/intake/ds1.local.test.ts`.

**What the data sets are (all invented, seeded with `rng` from `src/engine/testing/generate.ts`):** `datasets.ts` exports `buildDataset(name): { files: { name: string; bytes: Uint8Array; kind: Kind }[]; site: SiteProfile; expected: { caseCount: number; technicianCount: number; mappedFields: Record<string, string> } }` for five sets:
  - **DS-2 "plain English CSV":** UTF-8 comma, headers `Ticket No, Created On, Category, Locality, Status`, ISO dates, categories `Installation`, `Repair`, `Gas Refill`, statuses `Open`, `Pending Parts`, `Closed`.
  - **DS-3 "European semicolon":** Windows-1252 bytes, semicolon, decimal commas for coordinates, day-first dates `13.10.2026`, German-style headers (`Auftragsnummer`, `Erstellt am`, `Kategorie`, `Ort`, `Priorität`), umlauts in place names, a title line and a total row.
  - **DS-4 "Excel workbook":** `.xlsx` built with `write-excel-file`: two sheets (a cover sheet and the data sheet), Excel dates, a separate technician sheet file, coordinates in two columns, duplicate ticket numbers.
  - **DS-5 "JSON from a system":** `{ "tickets": [...] }` with nested `location: { lat, lon }`, ISO timestamps with offsets, priority words (`P1`..`P4`), unknown categories.
  - **DS-6 "UTF-16 tab file, ambiguous dates":** UTF-16 LE with BOM, tab-separated, dates `04/05/2026` (ambiguous in the whole file), no category column (one work type for the whole file), places only by postal code.
  For each set the `site` is the starter site extended with the set's place table (`extendPlaces`) and the technician list as `ImportedTechnician[]` built by hand.

- [ ] **Step 1: Failing tests (`conformance.test.ts`).** For every set and each file: `readSource` then `suggestProfile` then a confirmed profile (the test applies the suggestion, then adds the value maps and the date order exactly as a user would: for each `unknownValues` entry of a first `applyProfile` pass, map it according to `expected.valueMaps`; if `suggest` reports `ambiguous` date order set `dateOrder: 'dmy'`) then `applyProfile` gives `cases.length === expected.caseCount` after duplicates and total rows are excluded, zero `unknown_work_type` exceptions after mapping, and every defect the set contains reported (DS-3: one total row skipped; DS-4: duplicate ids counted; DS-5: unknown category went to review and was mapped; DS-6: ambiguous date reported then confirmed). Then `mergeImport` into `[]`, `toPlanInput` and `plan` all succeed and schedule at least 80% of the active cases. **Suggestion accuracy:** across all files, the share of mandatory and recommended fields whose suggested column equals `expected.mappedFields[field]` (with `confidence >= 0.8` counting as suggested) is at least 80%.
- [ ] **Step 2: Failing test (`roundtrip.test.ts`).** For each golden scenario input from `reference/golden/` named `baseline_mid`, `three_techs_default`, `pins`, `due_dates`, `product_types`: write the input out as open-format CSV files (`roundtrip.ts` converts a `PlanInput` into cases, technicians and places CSV text using `serializeCsv`; priority levels, product types and durations are written as names and numbers), import them with `openFormatProfile` and a site built from the input (`siteFromInput(input)` in `roundtrip.ts`), merge, `toPlanInput`, and `plan`; the resulting plan must equal the golden `expected` for the scenarios without features the open format does not carry; for `pins` compare the pinned cases' manual assignment as well. Where a feature cannot round-trip (for example `frozenTech`), the scenario is not in the list. Details that make the comparison fair: escalated cases are written with the priority word `Escalated` (default levels `Normal`, `Escalated` map to themselves); the engine adds `; priority <level>` to the reason of a case that sets `priority`, so the test removes that suffix from `why` before comparing; `product_types` is written as the computed visit minutes in `duration_min` (the site profile has no product list); `dueDay` is written as `due_at`, `reportedDay` as `reported_at` (helper `isoOf(day) = new Date(day * 86400000).toISOString().slice(0, 10)`, allowed in test code); plan start and holidays are passed through `PlanOptions`.
- [ ] **Step 3: Local-only real data (`ds1.local.test.ts`).** Skipped (`describe.skipIf`) unless the git-ignored folder `reference-local/ds1-files/` exists with `cases.csv`, `locations.xlsx`, `technicians.xlsx`, and `reference-local/ds1-profiles/*.json` (profiles written once by the owner's local mapping run). It imports the real files with those profiles and asserts the resulting `PlanInput` plans identically to `reference-local/ds1_baseline.json` (technician, day, visit, stop order). Add `py reference/export_ds1_local.py` no change; document the folder layout in `reference/README.md`. If the folder is absent the test reports as skipped, never passed.
- [ ] **Step 4: Implement `datasets.ts` and `roundtrip.ts`**, iterate until the tests pass. When a data set exposes a real gap in the library (a layout it cannot read), fix the library in the task that owns the code and add a unit test there.
- [ ] **Step 5:** Full local check; commit `test(intake): conformance data sets and end-to-end proofs`.

---

### Task 13: Documents, coverage and delivery

- [ ] **Step 1: Coverage.** `npm run test:coverage`; intake statements and lines at least 90%. Add tests for uncovered branches rather than excluding files.
- [ ] **Step 2: Docs.** Set the spec Status to implemented and record: the `.xls` deviation from FR-01.1 (moved to a later release), the dependency list, the measured accuracy of column suggestions on the five sets. Add `src/intake/README.md` (a short guide: the five functions, one worked example in code, the profile and site files). Update the memory notes.
- [ ] **Step 3: Whole-chain check and build.** Full local check, then `npm run build` (confirm the `.xlsx` package is in its own lazy chunk and the entry bundle did not grow beyond the budget of the requirements: print the sizes).
- [ ] **Step 4: Push.** `git push -u origin data-intake`; then ask the owner to open the pull request from `https://github.com/rudrakshk21/ac-service-scheduler/pull/new/data-intake` (no `gh`), watch the checks on the head commit, and ask for the merge click.

---

## Self-Review

- **Spec coverage:** section 3 (five functions) to Tasks 4, 5, 8, 9, 10; section 4 (shapes) to Shared types and Tasks 5, 6; section 5 (reading, detection) to Tasks 1 to 4; section 6 (mapping) to Tasks 5, 7, 8; section 7 (merge) to Task 9; section 8 (hand-off) to Task 10; section 9 (files, open format) to Tasks 6 and 11; section 11 (testing) to Tasks 1 to 12; section 12 (errors) in every reading task; finish line to Tasks 12 and 13.
- **Placeholders:** none intended. Where an implementation is described as a rule list (suggestion scoring, date parsing), the rules are exact enough to implement and the tests pin the behaviour. Task 4 step 3 depends on the installed package's entry points, which Task 0 step 1 reads before use.
- **Type consistency:** names are those of Shared types: `SourceTable`, `ReadOptions`, `MappingProfile`, `SiteProfile`, `SitePlace`, `ImportedCase`, `ImportedTechnician`, `Imported`, `IntakeException`, `QualityReport`, `StoredCase`, `ImportPreview`, `ChangeLogEntry`, `MergeResult`, `PlanOptions`; functions `readSource`, `buildTable`, `parseCsv`, `serializeCsv`, `detectDelimiter`, `decodeBytes`, `parseDate`, `detectDateOrder`, `parseNumber`, `detectDecimal`, `suggestProfile`, `fingerprintOf`, `parseProfile`, `serializeProfile`, `parseSite`, `serializeSite`, `extendPlaces`, `starterSite`, `mapWorkType`, `mapStatus`, `mapPriority`, `mapSkills`, `resolveLocation`, `applyProfile`, `mergeImport`, `toPlanInput`, `openFormatProfile`, `isOpenFormat`, `templateCsv`, `openFormatSchema`.
