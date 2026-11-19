# Planning Engine, Step 1 (the port): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Python planning engine to pure TypeScript so that it gives an identical plan, proven by golden files from the Python engine, and ship it with safety-rule tests and a thin Worker wrapper.

**Architecture:** `src/engine/` holds small pure modules (types, calendar, geo, route, order, plan, finalise) behind one entry point `plan(input)`. The Python engine is copied unchanged into `reference/python/`; a Python script turns synthetic scenarios into golden JSON files, and a Vitest test compares every discrete output of the web engine with them. Real data (DS-1) is exported to a git-ignored folder and compared only on the owner's PC.

**Tech Stack:** TypeScript 7 (strict, `erasableSyntaxOnly`, `verbatimModuleSyntax`), Vite 8, Vitest, fast-check, Python 3 standard library for the reference tooling, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-19-planning-engine-design.md` (this plan covers its sections 3 to 6, 9, 10 and the finish line of section 11 for step 1. Step 2, the generalisation in section 7, gets its own plan after the step 1 gate passes. Section 8, speed, is measured in step 2.)

## Global Constraints

- The engine is pure TypeScript: no React, no browser APIs, no storage, no runtime dependencies (NFR-14, spec section 13).
- Dates are whole day numbers counted from 1970-01-01, a Thursday. The engine never reads a clock or a time zone (ADR-5).
- The engine never sorts. The order of `cases` and `technicians` in the input is the tie-break order, exactly as in Python (BR-19).
- Identical means: every discrete output equals the Python result (technician, day, visit, arrival time, reason, flag, unscheduled cases and reasons, stop order of each route). Real-valued outputs (travel minutes, kilometres, load) match within 1e-9.
- Keep the Python arithmetic order, constants and tolerances: 1e-6 in fit checks, bonus 100000 for escalated cases, age cap 90 days, 3 placement passes, 20 relocation rounds, 200 two-opt rounds, relocation gain threshold 0.5.
- Python rounding is round-half-to-even; Python `int()` truncates toward zero.
- Real data (technician names, case IDs of DS-1) never enters a committed file. It lives only in the git-ignored folder `reference-local/`. Golden scenarios are synthetic.
- Engine statement and line coverage of at least 90 percent (NFR-13).
- TypeScript config in force: `types: ["vite/client"]` (no Node globals in `src`), `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` (no enums, no namespaces, no parameter properties), `verbatimModuleSyntax` (use `import type` for types).
- Commit messages follow Conventional Commits and end with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Commit locally. Do not push until the project owner says so.
- Run commands from the repository root `C:\Users\lenovo\Projects\ac-service-scheduler`. Use forward slashes in paths passed to npm.

## File Structure

```
src/engine/
  pymath.ts            Python-compatible rounding, int(), modulo, clock text
  types.ts             Input and output types
  calendar.ts          Day numbers, weekday, working-day and availability checks
  geo.ts               Haversine distance, travel-time table, zones
  context.ts           Ctx: the input plus precomputed geo, built once per plan
  check.ts             checkInput: plain-language rejection of invalid input
  route.ts             Route, travelOf, bestInsert, fits, recalc
  order.ts             orderRoute: exact search up to 10 stops, 2-opt above
  raw.ts               RawResult: the Python Result as Maps
  plan.ts              runPlan: day loop, pinned cases, greedy, relocate
  finalise.ts          Arrival times, visit numbers, kilometres, reasons
  index.ts             plan(input): the one entry point, plus type exports
  testing/             Test support, excluded from coverage
    fixtures.ts        START, testSettings, WORK_TYPES, testInput
    generate.ts        Seeded random PlanInput generator
    compare.ts         compareResults: lists differences between two results
    invariants.ts      checkInvariants: the safety rules INV-1 to INV-6
  *.test.ts            One test file per module, next to it
  golden.test.ts       Compares the engine with reference/golden/*.json
  ds1.local.test.ts    Compares with reference-local/*.json when that folder exists
src/worker/
  handler.ts           handlePlanRequest: pure function used by the worker
  handler.test.ts
  plan.worker.ts       Web Worker entry
  client.ts            planInWorker(input): Promise<PlanResult>
reference/
  python/engine.py     The Python engine, copied unchanged
  convert.py           PlanInput JSON <-> Python engine objects
  scenarios.py         Synthetic scenarios (seeded)
  export_golden.py     Writes reference/golden/*.json
  export_ds1_local.py  Writes reference-local/*.json (owner's PC only)
  test_reference.py    Python unit tests: scenarios exercise their features, goldens are current
  README.md
  golden/*.json        Generated, committed
```

---

### Task 1: Test tooling, coverage gate and ignore rules

**Files:**
- Modify: `package.json` (devDependencies and scripts, through npm)
- Modify: `vite.config.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm test` (runs Vitest once), `npm run test:coverage` (same with the coverage gate), the folder rule `/reference-local/` in `.gitignore`.

- [ ] **Step 1: Install the test tools**

Run:
```bash
npm install -D vitest @vitest/coverage-v8 fast-check
```
Expected: ends with `found 0 vulnerabilities`.

- [ ] **Step 2: Add the scripts**

Run:
```bash
npm pkg set scripts.test="vitest run"
npm pkg set "scripts.test:coverage=vitest run --coverage"
```
Check `package.json` now lists `"test": "vitest run"` and `"test:coverage": "vitest run --coverage"` under `scripts`.

- [ ] **Step 3: Replace `vite.config.ts`**

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts'],
      exclude: ['src/engine/**/*.test.ts', 'src/engine/testing/**'],
      thresholds: { statements: 90, lines: 90 },
    },
  },
})
```

- [ ] **Step 4: Ignore the local real-data folder**

Append to `.gitignore`:
```
# Real data exported for local tests only (never commit)
/reference-local/
```

- [ ] **Step 5: Check that the build still works**

Run: `npm run build`
Expected: `built in` with no errors (the config now imports from `vitest/config`).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts .gitignore
git commit -m "chore: add vitest, fast-check and the coverage gate" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Python-compatible number helpers (`pymath.ts`)

**Files:**
- Create: `src/engine/pymath.ts`
- Test: `src/engine/pymath.test.ts`
- Modify: `.github/workflows/ci.yml` (add the test step now that tests exist)

**Interfaces:**
- Produces:
  - `pyRound(x: number): number` Python `round(x)` for floats: halves go to the even integer; never returns `-0`.
  - `pyInt(x: number): number` Python `int(x)`: truncate toward zero; never returns `-0`.
  - `pyMod(a: number, n: number): number` Python `a % n` for `n > 0`: never negative.
  - `formatClock(minutes: number): string` Python `hm()`: `"%02d:%02d" % ((t // 60) % 24, t % 60)` with `t = int(round(minutes))`.

- [ ] **Step 1: Write the failing test**

`src/engine/pymath.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { formatClock, pyInt, pyMod, pyRound } from './pymath'

describe('pyRound (Python round: halves go to the even integer)', () => {
  it.each([
    [0.5, 0], [1.5, 2], [2.5, 2], [3.5, 4], [-0.5, 0], [-1.5, -2], [-2.5, -2],
    [0.49, 0], [0.51, 1], [2.4999, 2], [-0.4, 0], [7, 7], [540.5, 540], [541.5, 542], [599.5, 600],
  ])('pyRound(%f) = %i', (x, want) => {
    expect(pyRound(x)).toBe(want)
  })
})

describe('pyInt (Python int: truncate toward zero)', () => {
  it.each([[2.9, 2], [-2.9, -2], [0.2, 0], [-0.2, 0], [5, 5]])('pyInt(%f) = %i', (x, want) => {
    expect(pyInt(x)).toBe(want)
  })
})

describe('pyMod (Python %: never negative)', () => {
  it.each([[7, 7, 0], [8, 7, 1], [-1, 7, 6], [-8, 7, 6], [0, 24, 0]])('pyMod(%i, %i) = %i', (a, n, want) => {
    expect(pyMod(a, n)).toBe(want)
  })
})

describe('formatClock (Python hm)', () => {
  it.each([
    [540, '09:00'], [540.5, '09:00'], [541.5, '09:02'], [545, '09:05'], [780, '13:00'],
    [599.5, '10:00'], [1440, '00:00'], [1500, '01:00'], [5, '00:05'],
  ])('formatClock(%f) = %s', (minutes, want) => {
    expect(formatClock(minutes)).toBe(want)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/engine/pymath.test.ts`
Expected: FAIL, `Failed to resolve import "./pymath"`.

- [ ] **Step 3: Write the implementation**

`src/engine/pymath.ts`:
```ts
/** Python-compatible number helpers, so that the port rounds exactly like the reference engine. */

/** Python's round(x) for floats: a value exactly halfway goes to the nearest even integer. */
export function pyRound(x: number): number {
  const isHalf = Math.abs(x % 1) === 0.5
  const r = isHalf ? 2 * Math.round(x / 2) : Math.round(x)
  return r === 0 ? 0 : r // never -0
}

/** Python's int(x): truncate toward zero. */
export function pyInt(x: number): number {
  const r = Math.trunc(x)
  return r === 0 ? 0 : r
}

/** Python's a % n for n > 0: the result is never negative. */
export function pyMod(a: number, n: number): number {
  return ((a % n) + n) % n
}

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

/** Python's hm(minutes): clock text such as "09:05", from minutes after midnight. */
export function formatClock(minutes: number): string {
  const t = pyRound(minutes)
  return pad2(pyMod(Math.floor(t / 60), 24)) + ':' + pad2(pyMod(t, 60))
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/engine/pymath.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Add the test step to the pipeline**

In `.github/workflows/ci.yml`, replace the line `      - run: npm run lint` and the lines after it so that the steps read:
```yaml
      - run: npm ci
      - run: npm run lint
      - run: npm run test:coverage
      - run: npm run build
```
(The Python check is added in Task 7.)

- [ ] **Step 6: Run lint and commit**

Run: `npm run lint`
Expected: no findings.
```bash
git add src/engine/pymath.ts src/engine/pymath.test.ts .github/workflows/ci.yml
git commit -m "feat(engine): add Python-compatible rounding helpers" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Types, calendar and test fixtures

**Files:**
- Create: `src/engine/types.ts`
- Create: `src/engine/calendar.ts`
- Create: `src/engine/testing/fixtures.ts`
- Test: `src/engine/calendar.test.ts`

**Interfaces:**
- Consumes: `pyMod` from `./pymath`.
- Produces (`types.ts`): `Settings`, `WorkType`, `Technician`, `Place`, `CaseIn`, `PlanInput`, `ScheduledCase`, `UnscheduledCase`, `RouteSummary`, `PlanResult` exactly as below.
- Produces (`calendar.ts`): `dayNumber(isoDate: string): number`, `weekday(day: number): number` (Monday 0 to Sunday 6), `makeCalendar(s: Settings): { isWorkday(day: number): boolean }`, `isAvailable(tech: Technician, day: number): boolean`.
- Produces (`testing/fixtures.ts`): `START: number` (day number of 2026-10-13, a Tuesday), `WORK_TYPES: WorkType[]`, `testSettings(over?: Partial<Settings>): Settings`, `testInput(over?: Partial<PlanInput>): PlanInput`.

- [ ] **Step 1: Write `src/engine/types.ts`**

```ts
/** Planning settings. Times are minutes, distances kilometres, dates whole day numbers since 1970-01-01. */
export interface Settings {
  baseLat: number
  baseLon: number
  speedKmh: number
  roadFactor: number
  sameAreaHopMin: number
  usableMin: number
  dayStartMin: number
  lunchStartMin: number
  breakMin: number
  ageWeight: number
  balanceWeight: number
  maxKm: number
  horizonDays: number
  /** 0 = Monday ... 6 = Sunday. */
  restWeekdays: number[]
  holidays: number[]
  startDay: number
}

export interface WorkType {
  name: string
  serviceMin: number
  dailyCeiling: number
  requiredSkill: number
}

export interface Technician {
  name: string
  skills: number[]
  active: boolean
  leaveFrom?: number
  leaveTo?: number
  /** Step 2. Ignored in step 1: every route starts and ends at the base. */
  startPlace?: number
}

export interface Place {
  name: string
  lat: number
  lon: number
}

export interface CaseIn {
  id: string
  workType: number
  place: number
  escalated: boolean
  reportedDay: number
  /** Manual technician: index into `technicians`. */
  pinnedTech?: number
  /** Earliest day the case may be planned; with `pinnedTech` it is also the day it is placed. */
  earliestDay?: number
  /** Technician kept from the earlier plan, honoured on the start day only. */
  frozenTech?: number
}

export interface PlanInput {
  settings: Settings
  workTypes: WorkType[]
  technicians: Technician[]
  places: Place[]
  cases: CaseIn[]
}

export interface ScheduledCase {
  id: string
  day: number
  tech: number
  visit: number
  /** "HH:MM". */
  eta: string
  travelMin: number
  prevKm: number
  why: string
  flag: string
}

export interface UnscheduledCase {
  id: string
  reason: string
}

export interface RouteSummary {
  day: number
  tech: number
  stops: string[]
  travelMin: number
  serviceMin: number
  load: number
}

export interface PlanResult {
  /** In input case order. */
  scheduled: ScheduledCase[]
  /** In input case order. */
  unscheduled: UnscheduledCase[]
  days: number[]
  /** In day order; within a day, in technician order. Includes technicians with an empty route. */
  routes: RouteSummary[]
}
```

- [ ] **Step 2: Write the failing calendar test**

`src/engine/calendar.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { dayNumber, isAvailable, makeCalendar, weekday } from './calendar'
import { START, testSettings } from './testing/fixtures'

describe('dayNumber and weekday', () => {
  it('counts days from 1970-01-01, a Thursday', () => {
    expect(dayNumber('1970-01-01')).toBe(0)
    expect(dayNumber('1970-01-02')).toBe(1)
    expect(dayNumber('1969-12-31')).toBe(-1)
    expect(weekday(0)).toBe(3)
    expect(weekday(-1)).toBe(2)
  })
  it('knows the weekdays of the reference dates', () => {
    expect(weekday(dayNumber('2026-10-13'))).toBe(1) // Tuesday
    expect(weekday(dayNumber('2026-10-18'))).toBe(6) // Sunday
    expect(weekday(dayNumber('2026-10-19'))).toBe(0) // Monday
  })
  it('START is 2026-10-13', () => {
    expect(START).toBe(dayNumber('2026-10-13'))
  })
})

describe('makeCalendar', () => {
  it('skips rest days and holidays', () => {
    const cal = makeCalendar(testSettings({ restWeekdays: [6], holidays: [START + 2] }))
    expect(cal.isWorkday(START)).toBe(true)
    expect(cal.isWorkday(START + 2)).toBe(false) // holiday
    expect(cal.isWorkday(dayNumber('2026-10-18'))).toBe(false) // Sunday
  })
  it('lets Sunday be a working day when no rest day is set', () => {
    const cal = makeCalendar(testSettings({ restWeekdays: [] }))
    expect(cal.isWorkday(dayNumber('2026-10-18'))).toBe(true)
  })
})

describe('isAvailable', () => {
  const tech = { name: 'T', skills: [0], active: true }
  it('is false for an inactive technician', () => {
    expect(isAvailable({ ...tech, active: false }, START)).toBe(false)
  })
  it('is false inside the leave range, true outside it', () => {
    const t = { ...tech, leaveFrom: START + 1, leaveTo: START + 2 }
    expect(isAvailable(t, START)).toBe(true)
    expect(isAvailable(t, START + 1)).toBe(false)
    expect(isAvailable(t, START + 2)).toBe(false)
    expect(isAvailable(t, START + 3)).toBe(true)
  })
  it('treats a leave without an end date as open ended', () => {
    const t = { ...tech, leaveFrom: START + 1 }
    expect(isAvailable(t, START)).toBe(true)
    expect(isAvailable(t, START + 50)).toBe(false)
  })
})
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run src/engine/calendar.test.ts`
Expected: FAIL, cannot resolve `./calendar`.

- [ ] **Step 4: Write `src/engine/calendar.ts`**

```ts
import { pyMod } from './pymath'
import type { Settings, Technician } from './types'

/** Day number (days since 1970-01-01) of an ISO date such as "2026-10-13". */
export function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

/** Monday = 0 ... Sunday = 6. Day 0, 1970-01-01, was a Thursday. */
export function weekday(day: number): number {
  return pyMod(day + 3, 7)
}

export function makeCalendar(s: Settings): { isWorkday(day: number): boolean } {
  const rest = new Set(s.restWeekdays)
  const holidays = new Set(s.holidays)
  return { isWorkday: (day) => !rest.has(weekday(day)) && !holidays.has(day) }
}

/** A technician is available when active and not on leave that day. */
export function isAvailable(tech: Technician, day: number): boolean {
  if (!tech.active) return false
  if (tech.leaveFrom !== undefined && day >= tech.leaveFrom && (tech.leaveTo === undefined || day <= tech.leaveTo)) {
    return false
  }
  return true
}
```

- [ ] **Step 5: Write `src/engine/testing/fixtures.ts`**

```ts
import { dayNumber } from '../calendar'
import type { PlanInput, Settings, WorkType } from '../types'

/** 2026-10-13, a Tuesday: the plan start used by the reference scenarios. */
export const START = dayNumber('2026-10-13')

export const WORK_TYPES: WorkType[] = [
  { name: 'Installation', serviceMin: 120, dailyCeiling: 3, requiredSkill: 0 },
  { name: 'Service / RMS', serviceMin: 75, dailyCeiling: 5, requiredSkill: 1 },
  { name: 'Breakdown', serviceMin: 75, dailyCeiling: 5, requiredSkill: 2 },
]

/** The defaults of the Python reference engine, with an invented base location. */
export function testSettings(over: Partial<Settings> = {}): Settings {
  return {
    baseLat: 20,
    baseLon: 30,
    speedKmh: 30,
    roadFactor: 1.35,
    sameAreaHopMin: 10,
    usableMin: 480,
    dayStartMin: 540,
    lunchStartMin: 780,
    breakMin: 60,
    ageWeight: 4,
    balanceWeight: 0.05,
    maxKm: 60,
    horizonDays: 30,
    restWeekdays: [6],
    holidays: [],
    startDay: START,
    ...over,
  }
}

export function testInput(over: Partial<PlanInput> = {}): PlanInput {
  return {
    settings: testSettings(),
    workTypes: WORK_TYPES.map((w) => ({ ...w })),
    technicians: [],
    places: [],
    cases: [],
    ...over,
  }
}
```

- [ ] **Step 6: Run the test, lint and type check**

Run: `npx vitest run src/engine/calendar.test.ts`
Expected: all pass.
Run: `npm run lint` then `npx tsc -b`
Expected: no findings, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/engine/calendar.ts src/engine/calendar.test.ts src/engine/testing/fixtures.ts
git commit -m "feat(engine): add types, calendar and test fixtures" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Geometry and travel times (`geo.ts`)

**Files:**
- Create: `src/engine/geo.ts`
- Test: `src/engine/geo.test.ts`

**Interfaces:**
- Consumes: `pyMod`, `pyRound` from `./pymath`; `Place`, `Settings` from `./types`.
- Produces: `haversineKm(la1, lo1, la2, lo2): number`; `interface Geo { tm: number[][]; zone: string[]; areaKm: number[] }`; `buildGeo(s: Settings, places: Place[]): Geo`. Node 0 is the base, node `i + 1` is `places[i]`. `tm[i][j]` is travel minutes.

- [ ] **Step 1: Write the failing test**

`src/engine/geo.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildGeo, haversineKm } from './geo'
import { testSettings } from './testing/fixtures'

describe('haversineKm', () => {
  it('is 0 for the same point', () => {
    expect(haversineKm(20, 30, 20, 30)).toBe(0)
  })
  it('is one degree of arc along the equator: 6371 km times pi/180', () => {
    expect(haversineKm(0, 0, 0, 1)).toBeCloseTo(111.19492664455873, 8)
  })
  it('is symmetric', () => {
    expect(haversineKm(20, 30, 20.3, 30.4)).toBeCloseTo(haversineKm(20.3, 30.4, 20, 30), 12)
  })
})

describe('buildGeo travel times', () => {
  const s = testSettings()
  const places = [
    { name: 'North', lat: 20.1, lon: 30 },
    { name: 'Twin', lat: 20.1, lon: 30 },
    { name: 'Near', lat: 20.1000001, lon: 30 },
  ]
  const g = buildGeo(s, places)

  it('has a node for the base and one per place', () => {
    expect(g.tm.length).toBe(4)
    expect(g.tm[0].length).toBe(4)
  })
  it('is 0 at the base and the same-area hop inside a place', () => {
    expect(g.tm[0][0]).toBe(0)
    expect(g.tm[1][1]).toBe(10)
  })
  it('uses distance x road factor / speed x 60 for different points', () => {
    const km = haversineKm(20, 30, 20.1, 30)
    expect(g.tm[0][1]).toBeCloseTo((km * 1.35) / 30 * 60, 10)
  })
  it('never goes below half the same-area hop', () => {
    expect(g.tm[1][2]).toBe(5) // two places at the same spot
    expect(g.tm[1][3]).toBe(5) // two places a few centimetres apart
  })
})

describe('buildGeo zones and distances', () => {
  const s = testSettings()
  const places = [
    { name: 'N', lat: 20.1, lon: 30 },
    { name: 'E', lat: 20, lon: 30.1 },
    { name: 'S', lat: 19.9, lon: 30 },
    { name: 'W', lat: 20, lon: 29.9 },
    { name: 'NE', lat: 20.1, lon: 30.1 },
    { name: 'Centre', lat: 20.01, lon: 30 },
  ]
  const g = buildGeo(s, places)
  it('names the compass octant from the base', () => {
    expect(g.zone).toEqual(['North', 'East', 'South', 'West', 'North-East', 'Central'])
  })
  it('keeps the straight-line distance from the base', () => {
    expect(g.areaKm[0]).toBeCloseTo(11.119492664455873, 6)
    expect(g.areaKm[5]).toBeLessThan(4)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/engine/geo.test.ts`
Expected: FAIL, cannot resolve `./geo`.

- [ ] **Step 3: Write `src/engine/geo.ts`**

```ts
import { pyMod, pyRound } from './pymath'
import type { Place, Settings } from './types'

export function haversineKm(la1: number, lo1: number, la2: number, lo2: number): number {
  const r = 6371.0
  const p = Math.PI / 180.0
  const dLa = (la2 - la1) * p
  const dLo = (lo2 - lo1) * p
  const sa = Math.sin(dLa / 2)
  const so = Math.sin(dLo / 2)
  const a = sa * sa + Math.cos(la1 * p) * Math.cos(la2 * p) * (so * so)
  return 2 * r * Math.asin(Math.sqrt(a))
}

export interface Geo {
  /** Travel minutes between nodes. Node 0 is the base; node i + 1 is places[i]. */
  tm: number[][]
  /** Compass zone of each place, as seen from the base. */
  zone: string[]
  /** Straight-line kilometres from the base to each place. */
  areaKm: number[]
}

const OCTANTS = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West']
// Python's math.degrees multiplies by a precomputed 180 / pi.
const RAD_TO_DEG = 180.0 / Math.PI

export function buildGeo(s: Settings, places: Place[]): Geo {
  const n = places.length + 1
  const la = [s.baseLat, ...places.map((p) => p.lat)]
  const lo = [s.baseLon, ...places.map((p) => p.lon)]
  const tm: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        tm[i][j] = i === 0 ? 0.0 : s.sameAreaHopMin
      } else {
        tm[i][j] = Math.max(
          s.sameAreaHopMin * 0.5,
          ((haversineKm(la[i], lo[i], la[j], lo[j]) * s.roadFactor) / s.speedKmh) * 60.0,
        )
      }
    }
  }
  const zone: string[] = []
  const areaKm: number[] = []
  for (let i = 0; i < places.length; i++) {
    const km = haversineKm(la[0], lo[0], la[i + 1], lo[i + 1])
    const dy = la[i + 1] - la[0]
    const dx = (lo[i + 1] - lo[0]) * Math.cos((la[0] * Math.PI) / 180.0)
    let ang = Math.atan2(dx, dy) * RAD_TO_DEG
    if (ang < 0) ang += 360
    areaKm.push(km)
    zone.push(km < 4 ? 'Central' : OCTANTS[pyMod(pyRound(ang / 45.0), 8)])
  }
  return { tm, zone, areaKm }
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/engine/geo.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/geo.ts src/engine/geo.test.ts
git commit -m "feat(engine): add distance, travel-time table and zones" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Context and input check (`context.ts`, `check.ts`)

**Files:**
- Create: `src/engine/context.ts`
- Create: `src/engine/check.ts`
- Test: `src/engine/context.test.ts`
- Test: `src/engine/check.test.ts`

**Interfaces:**
- Consumes: `buildGeo`, `Geo` from `./geo`; types from `./types`.
- Produces (`context.ts`): `interface Ctx { s: Settings; workTypes: WorkType[]; technicians: Technician[]; places: Place[]; cases: CaseIn[]; geo: Geo; caseNode: number[] }` and `buildContext(input: PlanInput): Ctx`. `caseNode[c]` is the node of case `c`, which is `cases[c].place + 1`.
- Produces (`check.ts`): `checkInput(input: PlanInput): void`. Throws `Error` whose message is `Invalid planning input: <field path> <problem>`.

- [ ] **Step 1: Write the failing context test**

`src/engine/context.test.ts`:
```ts
import { expect, it } from 'vitest'
import { buildContext } from './context'
import { START, testInput } from './testing/fixtures'

it('builds the geometry once and maps each case to its node', () => {
  const input = testInput({
    places: [
      { name: 'A', lat: 20.1, lon: 30 },
      { name: 'B', lat: 20, lon: 30.1 },
    ],
    cases: [
      { id: '1', workType: 0, place: 1, escalated: false, reportedDay: START },
      { id: '2', workType: 1, place: 0, escalated: false, reportedDay: START },
    ],
  })
  const ctx = buildContext(input)
  expect(ctx.caseNode).toEqual([2, 1])
  expect(ctx.geo.tm.length).toBe(3)
  expect(ctx.s).toBe(input.settings)
  expect(ctx.cases).toBe(input.cases)
})
```

- [ ] **Step 2: Write the failing check test**

`src/engine/check.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { checkInput } from './check'
import type { PlanInput } from './types'
import { START, testInput } from './testing/fixtures'

function valid(): PlanInput {
  return testInput({
    technicians: [{ name: 'T1', skills: [0], active: true }],
    places: [{ name: 'A', lat: 20.1, lon: 30 }],
    cases: [{ id: '1', workType: 0, place: 0, escalated: false, reportedDay: START }],
  })
}

describe('checkInput', () => {
  it('accepts a valid input and an empty one', () => {
    expect(() => checkInput(valid())).not.toThrow()
    expect(() => checkInput(testInput())).not.toThrow()
  })

  const cases: [string, (i: PlanInput) => void, string][] = [
    ['speed of zero', (i) => { i.settings.speedKmh = 0 }, 'settings.speedKmh must be greater than 0'],
    ['negative usable minutes', (i) => { i.settings.usableMin = -1 }, 'settings.usableMin must be at least 0'],
    ['latitude out of range', (i) => { i.settings.baseLat = 95 }, 'settings.baseLat must be between -90 and 90'],
    ['rest weekday out of range', (i) => { i.settings.restWeekdays = [7] }, 'settings.restWeekdays[0] must be at most 6'],
    ['fractional horizon', (i) => { i.settings.horizonDays = 2.5 }, 'settings.horizonDays must be a whole number'],
    ['no work types', (i) => { i.workTypes = [] }, 'workTypes must list at least one work type'],
    ['zero ceiling', (i) => { i.workTypes[0].dailyCeiling = 0 }, 'workTypes[0].dailyCeiling must be greater than 0'],
    ['negative service time', (i) => { i.workTypes[1].serviceMin = -5 }, 'workTypes[1].serviceMin must be at least 0'],
    ['missing coordinate', (i) => { i.places[0].lat = NaN }, 'places[0].lat must be a finite number'],
    ['longitude out of range', (i) => { i.places[0].lon = 200 }, 'places[0].lon must be between -180 and 180'],
    ['case place out of range', (i) => { i.cases[0].place = 3 }, 'cases[0].place must be at most 0'],
    ['case work type out of range', (i) => { i.cases[0].workType = 3 }, 'cases[0].workType must be at most 2'],
    ['duplicate case id', (i) => { i.cases.push({ ...i.cases[0] }) }, 'cases[1].id "1" is used twice'],
    ['pinned technician out of range', (i) => { i.cases[0].pinnedTech = 4 }, 'cases[0].pinnedTech must be at most 0'],
    ['negative skill', (i) => { i.technicians[0].skills = [-1] }, 'technicians[0].skills[0] must be at least 0'],
    ['non-boolean active flag', (i) => { (i.technicians[0] as unknown as { active: unknown }).active = 'yes' }, 'technicians[0].active must be true or false'],
  ]
  it.each(cases)('rejects %s', (_label, mutate, message) => {
    const input = valid()
    mutate(input)
    expect(() => checkInput(input)).toThrow(`Invalid planning input: ${message}`)
  })
})
```

- [ ] **Step 3: Run both to see them fail**

Run: `npx vitest run src/engine/context.test.ts src/engine/check.test.ts`
Expected: FAIL, cannot resolve `./context` and `./check`.

- [ ] **Step 4: Write `src/engine/context.ts`**

```ts
import { buildGeo, type Geo } from './geo'
import type { CaseIn, PlanInput, Place, Settings, Technician, WorkType } from './types'

/** The input plus everything computed once per plan. */
export interface Ctx {
  s: Settings
  workTypes: WorkType[]
  technicians: Technician[]
  places: Place[]
  cases: CaseIn[]
  geo: Geo
  /** Node of each case in the travel table: its place index + 1 (node 0 is the base). */
  caseNode: number[]
}

export function buildContext(input: PlanInput): Ctx {
  return {
    s: input.settings,
    workTypes: input.workTypes,
    technicians: input.technicians,
    places: input.places,
    cases: input.cases,
    geo: buildGeo(input.settings, input.places),
    caseNode: input.cases.map((c) => c.place + 1),
  }
}
```

- [ ] **Step 5: Write `src/engine/check.ts`**

```ts
import type { PlanInput } from './types'

function fail(path: string, problem: string): never {
  throw new Error(`Invalid planning input: ${path} ${problem}`)
}

function needNum(path: string, x: number, min?: number): void {
  if (!Number.isFinite(x)) fail(path, 'must be a finite number')
  if (min !== undefined && x < min) fail(path, `must be at least ${min}`)
}

function needPositive(path: string, x: number): void {
  if (!Number.isFinite(x)) fail(path, 'must be a finite number')
  if (x <= 0) fail(path, 'must be greater than 0')
}

function needRange(path: string, x: number, lo: number, hi: number): void {
  if (!Number.isFinite(x)) fail(path, 'must be a finite number')
  if (x < lo || x > hi) fail(path, `must be between ${lo} and ${hi}`)
}

function needInt(path: string, x: number, min: number, max?: number): void {
  if (!Number.isInteger(x)) fail(path, 'must be a whole number')
  if (x < min) fail(path, `must be at least ${min}`)
  if (max !== undefined && x > max) fail(path, `must be at most ${max}`)
}

function needBool(path: string, x: unknown): void {
  if (typeof x !== 'boolean') fail(path, 'must be true or false')
}

function needText(path: string, x: unknown): void {
  if (typeof x !== 'string' || x === '') fail(path, 'must be text')
}

/** Rejects invalid input with a plain message that names the field. Full import validation is a later piece. */
export function checkInput(input: PlanInput): void {
  const s = input.settings
  needRange('settings.baseLat', s.baseLat, -90, 90)
  needRange('settings.baseLon', s.baseLon, -180, 180)
  needPositive('settings.speedKmh', s.speedKmh)
  needPositive('settings.roadFactor', s.roadFactor)
  needNum('settings.sameAreaHopMin', s.sameAreaHopMin, 0)
  needNum('settings.usableMin', s.usableMin, 0)
  needNum('settings.dayStartMin', s.dayStartMin, 0)
  needNum('settings.lunchStartMin', s.lunchStartMin, 0)
  needNum('settings.breakMin', s.breakMin, 0)
  needNum('settings.ageWeight', s.ageWeight, 0)
  needNum('settings.balanceWeight', s.balanceWeight, 0)
  needNum('settings.maxKm', s.maxKm, 0)
  needInt('settings.horizonDays', s.horizonDays, 0)
  needInt('settings.startDay', s.startDay, -1_000_000)
  s.restWeekdays.forEach((d, i) => needInt(`settings.restWeekdays[${i}]`, d, 0, 6))
  s.holidays.forEach((d, i) => needInt(`settings.holidays[${i}]`, d, -1_000_000))

  if (input.workTypes.length === 0) fail('workTypes', 'must list at least one work type')
  input.workTypes.forEach((w, i) => {
    needText(`workTypes[${i}].name`, w.name)
    needNum(`workTypes[${i}].serviceMin`, w.serviceMin, 0)
    needPositive(`workTypes[${i}].dailyCeiling`, w.dailyCeiling)
    needInt(`workTypes[${i}].requiredSkill`, w.requiredSkill, 0)
  })

  input.places.forEach((p, i) => {
    needText(`places[${i}].name`, p.name)
    needRange(`places[${i}].lat`, p.lat, -90, 90)
    needRange(`places[${i}].lon`, p.lon, -180, 180)
  })

  input.technicians.forEach((t, i) => {
    needText(`technicians[${i}].name`, t.name)
    needBool(`technicians[${i}].active`, t.active)
    t.skills.forEach((k, j) => needInt(`technicians[${i}].skills[${j}]`, k, 0))
    if (t.leaveFrom !== undefined) needInt(`technicians[${i}].leaveFrom`, t.leaveFrom, -1_000_000)
    if (t.leaveTo !== undefined) needInt(`technicians[${i}].leaveTo`, t.leaveTo, -1_000_000)
    if (t.startPlace !== undefined) needInt(`technicians[${i}].startPlace`, t.startPlace, 0, input.places.length - 1)
  })

  const seen = new Set<string>()
  input.cases.forEach((c, i) => {
    needText(`cases[${i}].id`, c.id)
    if (seen.has(c.id)) fail(`cases[${i}].id`, `"${c.id}" is used twice`)
    seen.add(c.id)
    needInt(`cases[${i}].workType`, c.workType, 0, input.workTypes.length - 1)
    needInt(`cases[${i}].place`, c.place, 0, input.places.length - 1)
    needBool(`cases[${i}].escalated`, c.escalated)
    needInt(`cases[${i}].reportedDay`, c.reportedDay, -1_000_000)
    if (c.pinnedTech !== undefined) needInt(`cases[${i}].pinnedTech`, c.pinnedTech, 0, input.technicians.length - 1)
    if (c.frozenTech !== undefined) needInt(`cases[${i}].frozenTech`, c.frozenTech, 0, input.technicians.length - 1)
    if (c.earliestDay !== undefined) needInt(`cases[${i}].earliestDay`, c.earliestDay, -1_000_000)
  })
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run src/engine/context.test.ts src/engine/check.test.ts`
Expected: all pass. If one `rejects ...` case reports a different message, change the message text in `check.ts` only if the test text is the wrong one; the test messages in this plan are the intended wording.

- [ ] **Step 7: Lint, type check, commit**

Run: `npm run lint` then `npx tsc -b`
Expected: clean.
```bash
git add src/engine/context.ts src/engine/context.test.ts src/engine/check.ts src/engine/check.test.ts
git commit -m "feat(engine): add planning context and plain-language input check" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Route operations and stop ordering (`route.ts`, `order.ts`, `testing/generate.ts`)

**Files:**
- Create: `src/engine/route.ts`
- Create: `src/engine/order.ts`
- Create: `src/engine/testing/generate.ts`
- Test: `src/engine/route.test.ts`
- Test: `src/engine/order.test.ts`

**Interfaces:**
- Consumes: `Ctx` from `./context`.
- Produces (`route.ts`): `class Route { stops: number[]; travel: number; service: number; frac: number; pinned: boolean; ver: number }` (all start at `[]`, 0, 0, 0, false, 0); `travelOf(ctx, stops: number[]): number`; `bestInsert(ctx, r: Route, c: number): { delta: number; pos: number }`; `fits(ctx, r: Route, c: number, delta: number): boolean`; `recalc(ctx, r: Route): void` (increments `ver`). Case numbers `c` are indexes into `ctx.cases`.
- Produces (`order.ts`): `orderRoute(ctx, r: Route): void` puts `r.stops` in the shortest order (exact up to 10 stops, 2-opt above) and calls `recalc`.
- Produces (`testing/generate.ts`): `rng(seed: number): () => number` (mulberry32, values in [0, 1)); `generateInput(seed, nPlaces, nTechs, nCases): PlanInput` (random settings, technician skills `[i % 3]`, about 15 percent inactive, about 20 percent with leave, no pins).

- [ ] **Step 1: Write `src/engine/testing/generate.ts`**

```ts
import type { PlanInput, Technician } from '../types'
import { START, testSettings, WORK_TYPES } from './fixtures'

/** Small seeded random number generator (mulberry32), values in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A random planning input without manual pins. The same seed always gives the same input. */
export function generateInput(seed: number, nPlaces: number, nTechs: number, nCases: number): PlanInput {
  const r = rng(seed)
  const int = (a: number, b: number): number => a + Math.floor(r() * (b - a + 1))
  const places = Array.from({ length: nPlaces }, (_, i) => ({
    name: `Place ${i + 1}`,
    lat: 20 + (r() - 0.5) * 0.5,
    lon: 30 + (r() - 0.5) * 0.5,
  }))
  const technicians = Array.from({ length: nTechs }, (_, i): Technician => {
    const t: Technician = { name: `Technician ${i + 1}`, skills: [i % 3], active: r() > 0.15 }
    if (r() < 0.2) {
      const from = START + int(0, 3)
      t.leaveFrom = from
      t.leaveTo = from + int(0, 3)
    }
    return t
  })
  const cases = Array.from({ length: nCases }, (_, i) => ({
    id: String(100001 + i),
    workType: int(0, 2),
    place: int(0, nPlaces - 1),
    escalated: r() < 0.05,
    reportedDay: START - int(0, 40),
  }))
  return {
    settings: testSettings({
      horizonDays: int(3, 15),
      holidays: r() < 0.3 ? [START + int(0, 6)] : [],
      restWeekdays: r() < 0.8 ? [6] : [],
    }),
    workTypes: WORK_TYPES.map((w) => ({ ...w })),
    technicians,
    places,
    cases,
  }
}
```

- [ ] **Step 2: Write the failing route test**

`src/engine/route.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildContext } from './context'
import { bestInsert, fits, recalc, Route, travelOf } from './route'
import { START, testInput } from './testing/fixtures'

function ctxFor(workTypes: number[]) {
  const places = workTypes.map((_, i) => ({ name: `P${i}`, lat: 20 + i * 0.05, lon: 30 + i * 0.03 }))
  const cases = workTypes.map((w, i) => ({ id: String(i + 1), workType: w, place: i, escalated: false, reportedDay: START }))
  return buildContext(testInput({ places, cases }))
}

describe('travelOf', () => {
  it('is 0 for no stops, base to place and back for one stop', () => {
    const ctx = ctxFor([0, 0])
    const tm = ctx.geo.tm
    expect(travelOf(ctx, [])).toBe(0)
    expect(travelOf(ctx, [0])).toBe(tm[0][1] + tm[1][0])
    expect(travelOf(ctx, [0, 1])).toBe(tm[0][1] + tm[1][2] + tm[2][0])
  })
})

describe('recalc', () => {
  it('sets travel, on-site minutes and the share of the daily ceilings, and bumps the version', () => {
    const ctx = ctxFor([0, 1])
    const r = new Route()
    r.stops = [0, 1]
    recalc(ctx, r)
    expect(r.ver).toBe(1)
    expect(r.service).toBe(120 + 75)
    expect(r.frac).toBe(1 / 3 + 1 / 5)
    expect(r.travel).toBe(travelOf(ctx, [0, 1]))
    recalc(ctx, r)
    expect(r.ver).toBe(2)
  })
})

describe('bestInsert', () => {
  it('costs a round trip for an empty route', () => {
    const ctx = ctxFor([0])
    const { delta, pos } = bestInsert(ctx, new Route(), 0)
    expect(pos).toBe(0)
    expect(delta).toBe(ctx.geo.tm[0][1] + ctx.geo.tm[1][0] - ctx.geo.tm[0][0])
  })
  it('picks the cheapest position: a place between two stops goes between them', () => {
    // A, B and C lie on a north-south line away from the base; B is exactly between A and C.
    const places = [
      { name: 'A', lat: 20, lon: 30.2 },
      { name: 'B', lat: 20.1, lon: 30.2 },
      { name: 'C', lat: 20.2, lon: 30.2 },
    ]
    const cases = places.map((_, i) => ({ id: String(i + 1), workType: 0, place: i, escalated: false, reportedDay: START }))
    const ctx = buildContext(testInput({ places, cases }))
    const r = new Route()
    r.stops = [0, 2] // base, A, C, base
    recalc(ctx, r)
    const { delta, pos } = bestInsert(ctx, r, 1) // insert B
    expect(pos).toBe(1)
    const tm = ctx.geo.tm
    expect(delta).toBe(tm[1][2] + tm[2][3] - tm[1][3])
  })
})

describe('fits', () => {
  it('rejects a case that would pass the usable minutes, accepts one that just fits', () => {
    const ctx = ctxFor([0, 1])
    const r = new Route()
    r.service = 400
    expect(fits(ctx, r, 0, 0)).toBe(false) // 400 + 120 > 480
    expect(fits(ctx, r, 1, 0)).toBe(true) // 400 + 75 <= 480
    expect(fits(ctx, r, 1, 6)).toBe(false) // 6 extra minutes of travel tip it over
  })
  it('rejects a case once the daily ceilings are used up', () => {
    const ctx = ctxFor([0])
    const r = new Route()
    r.frac = 1
    expect(fits(ctx, r, 0, 0)).toBe(false)
    r.frac = 2 / 3
    expect(fits(ctx, r, 0, 0)).toBe(true)
  })
})
```

- [ ] **Step 3: Write the failing order test**

`src/engine/order.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildContext } from './context'
import { orderRoute } from './order'
import { recalc, Route, travelOf } from './route'
import { generateInput } from './testing/generate'

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs]
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]))
}

function routeOf(ctxStops: number[], ctx: ReturnType<typeof buildContext>): Route {
  const r = new Route()
  r.stops = [...ctxStops]
  recalc(ctx, r)
  return r
}

describe('orderRoute', () => {
  it('leaves routes of 0 or 1 stop alone', () => {
    const ctx = buildContext(generateInput(1, 3, 3, 3))
    const empty = routeOf([], ctx)
    orderRoute(ctx, empty)
    expect(empty.stops).toEqual([])
    const one = routeOf([2], ctx)
    orderRoute(ctx, one)
    expect(one.stops).toEqual([2])
  })

  it('finds the shortest order for up to 7 stops (exact search)', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const ctx = buildContext(generateInput(seed, 7, 3, 7))
      const stops = ctx.cases.map((_, i) => i)
      const r = routeOf([...stops].reverse(), ctx)
      orderRoute(ctx, r)
      const best = Math.min(...permutations(stops).map((p) => travelOf(ctx, p)))
      expect(r.travel).toBeCloseTo(best, 9)
      expect([...r.stops].sort((a, b) => a - b)).toEqual(stops)
    }
  })

  it('never makes a route of more than 10 stops longer, and loses no stop (2-opt)', () => {
    for (const seed of [11, 12, 13]) {
      const ctx = buildContext(generateInput(seed, 12, 3, 12))
      const stops = ctx.cases.map((_, i) => i)
      const r = routeOf(stops, ctx)
      const before = r.travel
      orderRoute(ctx, r)
      expect(r.travel).toBeLessThanOrEqual(before + 1e-9)
      expect([...r.stops].sort((a, b) => a - b)).toEqual(stops)
      expect(r.travel).toBe(travelOf(ctx, r.stops))
    }
  })
})
```

- [ ] **Step 4: Run both to see them fail**

Run: `npx vitest run src/engine/route.test.ts src/engine/order.test.ts`
Expected: FAIL, cannot resolve `./route` and `./order`.

- [ ] **Step 5: Write `src/engine/route.ts`**

```ts
import type { Ctx } from './context'

/** One technician's stops for one day. `ver` changes whenever the stops change (used by the greedy cache). */
export class Route {
  stops: number[] = []
  travel = 0.0
  service = 0.0
  frac = 0.0
  pinned = false
  ver = 0
}

/** Travel minutes of a stop list: base, each stop in order, base. */
export function travelOf(ctx: Ctx, stops: number[]): number {
  if (stops.length === 0) return 0.0
  const tm = ctx.geo.tm
  let t = 0.0
  let prev = 0
  for (const c of stops) {
    const nd = ctx.caseNode[c]
    t += tm[prev][nd]
    prev = nd
  }
  return t + tm[prev][0]
}

/** Cheapest place to add case `c` to the route: the extra travel minutes and the position. */
export function bestInsert(ctx: Ctx, r: Route, c: number): { delta: number; pos: number } {
  let delta = Infinity
  let pos = 0
  const n = r.stops.length
  const cn = ctx.caseNode[c]
  const tm = ctx.geo.tm
  for (let p = 0; p <= n; p++) {
    const prev = p === 0 ? 0 : ctx.caseNode[r.stops[p - 1]]
    const nxt = p === n ? 0 : ctx.caseNode[r.stops[p]]
    const d = tm[prev][cn] + tm[cn][nxt] - tm[prev][nxt]
    if (d < delta) {
      delta = d
      pos = p
    }
  }
  return { delta, pos }
}

/** Whether adding case `c` (extra travel `delta`) keeps the route within usable minutes and the daily ceilings. */
export function fits(ctx: Ctx, r: Route, c: number, delta: number): boolean {
  const wt = ctx.workTypes[ctx.cases[c].workType]
  if (r.travel + delta + r.service + wt.serviceMin > ctx.s.usableMin + 1e-6) return false
  if (r.frac + 1.0 / wt.dailyCeiling > 1.0 + 1e-6) return false
  return true
}

/** Recomputes travel, on-site minutes and the share of the daily ceilings from the stop list. */
export function recalc(ctx: Ctx, r: Route): void {
  r.ver += 1
  r.travel = travelOf(ctx, r.stops)
  r.service = 0.0
  r.frac = 0.0
  for (const c of r.stops) {
    const wt = ctx.workTypes[ctx.cases[c].workType]
    r.service += wt.serviceMin
    r.frac += 1.0 / wt.dailyCeiling
  }
}
```

- [ ] **Step 6: Write `src/engine/order.ts`**

```ts
import type { Ctx } from './context'
import { recalc, travelOf, type Route } from './route'

/**
 * Puts the stops of a route in the shortest order: an exact search (Held-Karp) up to 10 stops,
 * 2-opt improvement above that. Ends by recalculating the route.
 */
export function orderRoute(ctx: Ctx, r: Route): void {
  const n = r.stops.length
  if (n < 2) {
    recalc(ctx, r)
    return
  }
  const tm = ctx.geo.tm
  if (n <= 10) {
    const nodes = r.stops.map((c) => ctx.caseNode[c])
    const full = 1 << n
    const dp = new Float64Array(full * n).fill(Infinity)
    const par = new Int8Array(full * n).fill(-1)
    for (let j = 0; j < n; j++) dp[(1 << j) * n + j] = tm[0][nodes[j]]
    for (let m = 1; m < full; m++) {
      for (let j = 0; j < n; j++) {
        if (!((m >> j) & 1)) continue
        const dj = dp[m * n + j]
        if (dj === Infinity) continue
        for (let k = 0; k < n; k++) {
          if ((m >> k) & 1) continue
          const nm = m | (1 << k)
          const v = dj + tm[nodes[j]][nodes[k]]
          if (v < dp[nm * n + k]) {
            dp[nm * n + k] = v
            par[nm * n + k] = j
          }
        }
      }
    }
    let best = Infinity
    let bj = 0
    for (let j = 0; j < n; j++) {
      const v = dp[(full - 1) * n + j] + tm[nodes[j]][0]
      if (v < best) {
        best = v
        bj = j
      }
    }
    const seq: number[] = []
    let mask = full - 1
    let cur = bj
    while (cur !== -1) {
      seq.push(r.stops[cur])
      const p = par[mask * n + cur]
      mask &= ~(1 << cur)
      cur = p
    }
    seq.reverse()
    r.stops = seq
  } else {
    let imp = true
    let guard = 0
    while (imp && guard < 200) {
      guard += 1
      imp = false
      const cur = travelOf(ctx, r.stops)
      for (let i = 0; i < n - 1; i++) {
        if (imp) break
        for (let j = i + 1; j < n; j++) {
          const t = [...r.stops]
          const seg = t.slice(i, j + 1).reverse()
          t.splice(i, seg.length, ...seg)
          const v = travelOf(ctx, t)
          if (v < cur - 1e-6) {
            r.stops = t
            imp = true
            break
          }
        }
      }
    }
  }
  recalc(ctx, r)
}
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `npx vitest run src/engine/route.test.ts src/engine/order.test.ts`
Expected: all pass.

- [ ] **Step 8: Lint, type check, commit**

Run: `npm run lint` then `npx tsc -b`
Expected: clean.
```bash
git add src/engine/route.ts src/engine/route.test.ts src/engine/order.ts src/engine/order.test.ts src/engine/testing/generate.ts
git commit -m "feat(engine): add route operations and exact stop ordering" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Python reference tooling and the golden files

**Files:**
- Create: `reference/python/engine.py` (copied unchanged)
- Create: `reference/convert.py`
- Create: `reference/scenarios.py`
- Create: `reference/export_golden.py`
- Create: `reference/test_reference.py`
- Create: `reference/README.md`
- Create: `reference/golden/*.json` (generated)
- Modify: `.github/workflows/ci.yml` (Python check)

**Interfaces:**
- Produces (`convert.py`): `day_number(date) -> int`, `day_date(n) -> date`, `to_python(inp: dict) -> engine.Engine`, `from_python(eng, res) -> dict` (the `PlanResult` JSON shape), `to_input(eng) -> dict` (a built Python `Engine` back to `PlanInput` JSON).
- Produces (`scenarios.py`): `START` (day number of 2026-10-13), `SCENARIOS: dict[str, callable]` (16 scenarios, each returns a `PlanInput` dict).
- Produces (`export_golden.py`): `build_all() -> list[(name, payload)]` with `payload = {"name", "input", "expected"}`; `GOLDEN_DIR`; running it writes one compact JSON file per scenario.
- Golden file shape: `{"name": str, "input": PlanInput, "expected": PlanResult}`, matching `src/engine/types.ts` field for field.

- [ ] **Step 1: Copy the Python engine unchanged**

Run:
```bash
mkdir -p reference/python reference/golden
cp "C:/Users/lenovo/OneDrive - iitkgp.ac.in/Desktop/HW/AC_Scheduler_Python/ac_scheduler/engine.py" reference/python/engine.py
```
Expected: `reference/python/engine.py` exists and has 422 lines.
Check it imports only the standard library: `py -c "import ast,sys; t=ast.parse(open('reference/python/engine.py',encoding='utf-8').read()); print([n.names[0].name if isinstance(n, ast.Import) else n.module for n in ast.walk(t) if isinstance(n,(ast.Import,ast.ImportFrom))])"`
Expected: `['__future__', 'datetime', 'math', 'dataclasses']`.

- [ ] **Step 2: Write the failing Python test**

`reference/test_reference.py`:
```python
"""Checks the reference tooling: every scenario exercises what it is for, and the committed
golden files are exactly what the Python engine produces today."""
import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import export_golden  # noqa: E402


class ReferenceTooling(unittest.TestCase):
    def test_there_are_sixteen_distinct_scenarios(self):
        names = [name for name, _ in export_golden.build_all()]
        self.assertEqual(len(names), 16)
        self.assertEqual(len(set(names)), 16)

    def test_golden_files_are_current(self):
        for name, payload in export_golden.build_all():
            path = export_golden.GOLDEN_DIR / (name + ".json")
            self.assertTrue(path.exists(), "missing golden file for " + name + ": run py reference/export_golden.py")
            on_disk = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(on_disk, payload, name + " is stale: run py reference/export_golden.py")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run it to see it fail**

Run: `py reference/test_reference.py`
Expected: `ModuleNotFoundError: No module named 'export_golden'`.

- [ ] **Step 4: Write `reference/convert.py`**

```python
"""Converts between the web engine's JSON shapes and the Python reference engine's own objects."""
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "python"))
import engine  # noqa: E402  (the reference engine, copied unchanged)

EPOCH = dt.date(1970, 1, 1)


def day_number(d):
    return (d - EPOCH).days


def day_date(n):
    return EPOCH + dt.timedelta(days=n)


def to_python(inp):
    """Builds the Python Engine for a PlanInput dict. The reference knows only three work types
    (required skill = work type), a Sunday rest day and a base start for every route."""
    s = inp["settings"]
    assert set(s["restWeekdays"]) <= {6}, "the Python reference only knows Sunday as a rest day"
    assert [w["requiredSkill"] for w in inp["workTypes"]] == [0, 1, 2], "the Python reference has exactly 3 work types"
    assert all("startPlace" not in t for t in inp["technicians"]), "the Python reference starts every route at the base"
    cfg = engine.Cfg(
        store_lat=s["baseLat"], store_lon=s["baseLon"], speed=s["speedKmh"], road_factor=s["roadFactor"],
        hop_min=s["sameAreaHopMin"], usable_min=s["usableMin"], age_w=s["ageWeight"], bal_w=s["balanceWeight"],
        max_km=s["maxKm"], start_min=s["dayStartMin"], lunch_min=s["lunchStartMin"], break_min=s["breakMin"],
        svc_min=[w["serviceMin"] for w in inp["workTypes"]], target=[w["dailyCeiling"] for w in inp["workTypes"]],
        horizon=s["horizonDays"], sundays=(6 not in s["restWeekdays"]), start=day_date(s["startDay"]),
        holidays={day_date(d) for d in s["holidays"]},
    )
    cases = [
        engine.CaseIn(
            id=c["id"], cat=c["workType"], area=c["place"], esc=c["escalated"], reported=day_date(c["reportedDay"]),
            req_tech=c.get("pinnedTech", -1),
            man_date=day_date(c["earliestDay"]) if "earliestDay" in c else None,
            freeze_tech=c.get("frozenTech", -1),
        )
        for c in inp["cases"]
    ]
    techs = [
        engine.TechIn(
            name=t["name"], skill=[i in t["skills"] for i in range(3)], active=t["active"],
            leave_from=day_date(t["leaveFrom"]) if "leaveFrom" in t else None,
            leave_to=day_date(t["leaveTo"]) if "leaveTo" in t else None,
        )
        for t in inp["technicians"]
    ]
    places = inp["places"]
    return engine.Engine(cfg, cases, techs, [p["name"] for p in places], [p["lat"] for p in places], [p["lon"] for p in places])


def from_python(eng, res):
    """The Python Result as the PlanResult dict. Order: cases in input order, routes by day then technician."""
    scheduled = []
    for i, c in enumerate(eng.cases):
        if i in res.date:
            scheduled.append({
                "id": c.id, "day": day_number(res.date[i]), "tech": res.tech[i], "visit": res.visit[i],
                "eta": res.eta[i], "travelMin": res.travel_min[i], "prevKm": res.prev_km[i],
                "why": res.why[i], "flag": res.flag.get(i, ""),
            })
    unscheduled = [{"id": eng.cases[i].id, "reason": res.unsched_reason.get(i, "")} for i in sorted(res.unscheduled)]
    routes = []
    for d in res.days:
        for t, r in res.routes[d].items():
            routes.append({
                "day": day_number(d), "tech": t, "stops": [eng.cases[c].id for c in r.stops],
                "travelMin": r.travel, "serviceMin": r.service, "load": r.frac,
            })
    return {"scheduled": scheduled, "unscheduled": unscheduled, "days": [day_number(d) for d in res.days], "routes": routes}


def to_input(eng):
    """A built Python Engine back to a PlanInput dict (used to export real data without hand conversion)."""
    c = eng.C
    technicians = []
    for t in eng.techs:
        out = {"name": t.name, "skills": [i for i, has in enumerate(t.skill) if has], "active": t.active}
        if t.leave_from:
            out["leaveFrom"] = day_number(t.leave_from)
        if t.leave_to:
            out["leaveTo"] = day_number(t.leave_to)
        technicians.append(out)
    cases = []
    for k in eng.cases:
        out = {"id": k.id, "workType": k.cat, "place": k.area, "escalated": k.esc, "reportedDay": day_number(k.reported)}
        if k.req_tech >= 0:
            out["pinnedTech"] = k.req_tech
        if k.man_date:
            out["earliestDay"] = day_number(k.man_date)
        if k.freeze_tech >= 0:
            out["frozenTech"] = k.freeze_tech
        cases.append(out)
    return {
        "settings": {
            "baseLat": c.store_lat, "baseLon": c.store_lon, "speedKmh": c.speed, "roadFactor": c.road_factor,
            "sameAreaHopMin": c.hop_min, "usableMin": c.usable_min, "dayStartMin": c.start_min,
            "lunchStartMin": c.lunch_min, "breakMin": c.break_min, "ageWeight": c.age_w, "balanceWeight": c.bal_w,
            "maxKm": c.max_km, "horizonDays": c.horizon, "restWeekdays": [] if c.sundays else [6],
            "holidays": sorted(day_number(d) for d in c.holidays), "startDay": day_number(c.start),
        },
        "workTypes": [
            {"name": engine.CAT_NAMES[i], "serviceMin": c.svc_min[i], "dailyCeiling": c.target[i], "requiredSkill": i}
            for i in range(3)
        ],
        "technicians": technicians,
        "places": [{"name": n, "lat": la, "lon": lo} for n, la, lo in zip(eng.area_name, eng.lat, eng.lon)],
        "cases": cases,
    }
```

- [ ] **Step 5: Write `reference/scenarios.py`**

```python
"""Synthetic planning scenarios for the golden files. Everything here is invented: a made-up region and
made-up names. Uses only random.Random.random(), whose output is stable across Python versions."""
import copy
import datetime as dt
import random

from convert import day_number

START = day_number(dt.date(2026, 10, 13))  # a Tuesday

WORK_TYPES = [
    {"name": "Installation", "serviceMin": 120.0, "dailyCeiling": 3.0, "requiredSkill": 0},
    {"name": "Service / RMS", "serviceMin": 75.0, "dailyCeiling": 5.0, "requiredSkill": 1},
    {"name": "Breakdown", "serviceMin": 75.0, "dailyCeiling": 5.0, "requiredSkill": 2},
]


class Rng:
    def __init__(self, seed):
        self._r = random.Random(seed)

    def random(self):
        return self._r.random()

    def int(self, a, b):
        return a + int(self._r.random() * (b - a + 1))

    def pick(self, weights):
        x = self._r.random() * sum(weights)
        acc = 0.0
        for i, w in enumerate(weights):
            acc += w
            if x < acc:
                return i
        return len(weights) - 1


def settings(**over):
    s = dict(baseLat=20.0, baseLon=30.0, speedKmh=30.0, roadFactor=1.35, sameAreaHopMin=10.0, usableMin=480.0,
             dayStartMin=540.0, lunchStartMin=780.0, breakMin=60.0, ageWeight=4.0, balanceWeight=0.05, maxKm=60.0,
             horizonDays=30, restWeekdays=[6], holidays=[], startDay=START)
    s.update(over)
    return s


def make_places(rng, n):
    return [{"name": "Place %02d" % (i + 1), "lat": round(20.0 + (rng.random() - 0.5) * 0.5, 5),
             "lon": round(30.0 + (rng.random() - 0.5) * 0.5, 5)} for i in range(n)]


def make_techs(n):
    return [{"name": "Technician %02d" % (i + 1), "skills": [i % 3], "active": True} for i in range(n)]


def make_cases(rng, n, n_places):
    return [{"id": str(100001 + i), "workType": rng.pick([29, 31, 40]), "place": rng.int(0, n_places - 1),
             "escalated": rng.random() < 0.03, "reportedDay": START - rng.int(0, 40)} for i in range(n)]


def base(seed, n_cases, n_techs, n_places, **settings_over):
    rng = Rng(seed)
    places = make_places(rng, n_places)
    cases = make_cases(rng, n_cases, n_places)
    return {"settings": settings(**settings_over), "workTypes": copy.deepcopy(WORK_TYPES),
            "technicians": make_techs(n_techs), "places": places, "cases": cases}


def tech_for_type(inp, work_type, nth=0):
    """Index of the nth technician who holds the skill of a work type."""
    return [i for i, t in enumerate(inp["technicians"]) if work_type in t["skills"]][nth]


def baseline_mid():
    return base(1, 70, 9, 14)


def tech_inactive():
    inp = base(1, 70, 9, 14)
    inp["technicians"][1]["active"] = False
    return inp


def tech_leave():
    inp = base(1, 70, 9, 14)
    inp["technicians"][2]["leaveFrom"] = START
    inp["technicians"][2]["leaveTo"] = START + 2
    return inp


def three_techs_default():
    return base(2, 90, 3, 10)


def holiday():
    return base(2, 90, 3, 10, holidays=[START + 2])


def sunday_work():
    return base(2, 90, 3, 10, restWeekdays=[])


def pins():
    inp = base(3, 60, 9, 12)
    cs = inp["cases"]
    cs[0]["workType"] = 0
    cs[0]["pinnedTech"] = tech_for_type(inp, 0, 0)
    cs[0]["earliestDay"] = START
    cs[1]["workType"] = 1
    cs[1]["pinnedTech"] = tech_for_type(inp, 1, 1)
    cs[1]["earliestDay"] = START + 1
    cs[2]["earliestDay"] = START + 2
    cs[3]["workType"] = 2
    cs[3]["pinnedTech"] = tech_for_type(inp, 2, 0)
    return inp


def frozen():
    inp = base(4, 60, 9, 12)
    for i in range(10):
        c = inp["cases"][i]
        c["frozenTech"] = tech_for_type(inp, c["workType"], i % 3)
    return inp


def escalated_many():
    inp = base(5, 80, 9, 12)
    for i in (3, 11, 19, 27, 35, 43):
        inp["cases"][i]["escalated"] = True
    return inp


def long_routes():
    inp = base(6, 45, 3, 3)
    for w in inp["workTypes"]:
        w["serviceMin"] = 10.0
        w["dailyCeiling"] = 40.0
    return inp


def overload_pin():
    inp = base(7, 30, 6, 8)
    for i in range(8):
        inp["cases"][i]["workType"] = 0
        inp["cases"][i]["pinnedTech"] = 0
        inp["cases"][i]["earliestDay"] = START
    return inp


def unscheduled_reasons():
    inp = base(8, 40, 6, 8, horizonDays=1)
    inp["technicians"][0]["active"] = False  # skills [0]
    inp["technicians"][3]["active"] = False  # skills [0]: nobody can do Installation any more
    c = inp["cases"][5]
    c["workType"] = 1
    c["pinnedTech"] = 2  # a Breakdown technician: not approved for Service
    return inp


def identical_places():
    inp = base(9, 50, 6, 4)
    first = inp["places"][0]
    for p in inp["places"][1:]:
        p["lat"], p["lon"] = first["lat"], first["lon"]
    return inp


def half_minutes():
    # Travel between different places is exactly half the hop (0.5 min), so arrival times land on .5.
    return base(10, 24, 6, 6, sameAreaHopMin=1.0, speedKmh=1.0e9)


def large_random_a():
    return base(11, 200, 20, 40)


def large_random_b():
    return base(12, 260, 12, 25)


SCENARIOS = {f.__name__: f for f in (
    baseline_mid, tech_inactive, tech_leave, three_techs_default, holiday, sunday_work, pins, frozen,
    escalated_many, long_routes, overload_pin, unscheduled_reasons, identical_places, half_minutes,
    large_random_a, large_random_b,
)}
```

- [ ] **Step 6: Write `reference/export_golden.py`**

```python
"""Writes the golden files: each scenario's input and the Python reference engine's complete plan.
Usage: py reference/export_golden.py"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import convert  # noqa: E402
from convert import engine, from_python, to_python  # noqa: E402
from scenarios import SCENARIOS, START  # noqa: E402

GOLDEN_DIR = HERE / "golden"


def run_scenario(inp):
    """Runs the Python engine. Returns the PlanResult dict and every clock value passed to hm()."""
    calls = []
    original = engine.hm
    engine.hm = lambda minutes: (calls.append(minutes), original(minutes))[1]
    try:
        eng = to_python(inp)
        res = eng.plan()
    finally:
        engine.hm = original
    return from_python(eng, res), calls


def _is_sunday(day):
    return (day + 3) % 7 == 6


def _scheduled(out):
    return out["scheduled"]


def check_long_routes(inp, out, calls):
    assert max(len(r["stops"]) for r in out["routes"]) > 10, "no route has more than 10 stops"


def check_pins(inp, out, calls):
    assert any(s["why"] == "Manual assignment" for s in _scheduled(out)), "no pinned case was placed"


def check_frozen(inp, out, calls):
    assert any(s["why"].startswith("Kept from earlier plan") for s in _scheduled(out)), "no frozen case was kept"


def check_overload(inp, out, calls):
    assert any(s["flag"] == "OVER CAPACITY" for s in _scheduled(out)), "no day is over capacity"


def check_unscheduled(inp, out, calls):
    reasons = " | ".join(u["reason"] for u in out["unscheduled"])
    for text in ("No active technician has this skill", "Manual technician is not approved for this work type", "Beyond planning horizon"):
        assert text in reasons, "missing unscheduled reason: " + text


def check_half(inp, out, calls):
    assert any(abs(m % 1 - 0.5) < 1e-12 for m in calls), "no arrival time falls on exactly half a minute"


def check_escalated(inp, out, calls):
    ids = {c["id"] for c in inp["cases"] if c["escalated"]}
    assert any(s["id"] in ids and s["day"] == START for s in _scheduled(out)), "no escalated case on the first day"


def check_holiday(inp, out, calls):
    assert all(s["day"] != START + 2 for s in _scheduled(out)), "a visit falls on the holiday"
    assert max(s["day"] for s in _scheduled(out)) > START + 2, "the plan ends before the holiday"


def check_sunday_work(inp, out, calls):
    assert any(_is_sunday(s["day"]) for s in _scheduled(out)), "no visit falls on a Sunday"


def check_sunday_rest(inp, out, calls):
    assert not any(_is_sunday(s["day"]) for s in _scheduled(out)), "a visit falls on a Sunday"
    assert max(s["day"] for s in _scheduled(out)) > START + 5, "the plan ends before the first Sunday"


def check_inactive(inp, out, calls):
    assert all(s["tech"] != 1 for s in _scheduled(out)), "the inactive technician has a visit"


def check_leave(inp, out, calls):
    assert all(not (s["tech"] == 2 and START <= s["day"] <= START + 2) for s in _scheduled(out)), "visit during leave"


def check_large(inp, out, calls):
    assert len(_scheduled(out)) > 150, "too few cases scheduled"


CHECKS = {
    "long_routes": check_long_routes, "pins": check_pins, "frozen": check_frozen, "overload_pin": check_overload,
    "unscheduled_reasons": check_unscheduled, "half_minutes": check_half, "escalated_many": check_escalated,
    "holiday": check_holiday, "sunday_work": check_sunday_work, "three_techs_default": check_sunday_rest,
    "tech_inactive": check_inactive, "tech_leave": check_leave, "large_random_a": check_large,
}


def build_all():
    """Runs every scenario and its self-check. Returns [(name, payload)]."""
    built = []
    for name, build in SCENARIOS.items():
        inp = build()
        result, calls = run_scenario(inp)
        check = CHECKS.get(name)
        if check:
            check(inp, result, calls)
        built.append((name, {"name": name, "input": inp, "expected": result}))
    return built


def main():
    GOLDEN_DIR.mkdir(exist_ok=True)
    for name, payload in build_all():
        (GOLDEN_DIR / (name + ".json")).write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        out = payload["expected"]
        print("%-22s %4d scheduled, %3d unscheduled, %2d days" % (name, len(out["scheduled"]), len(out["unscheduled"]), len(out["days"])))


if __name__ == "__main__":
    main()
```
(`import convert` is kept so that `convert` sets up the import path for `engine` before `from convert import engine`.)

- [ ] **Step 7: Generate the golden files**

Run: `py reference/export_golden.py`
Expected: 16 lines, one per scenario, none raising `AssertionError`. If a scenario self-check fails (for example `no route has more than 10 stops`), change that scenario's numbers in `reference/scenarios.py` (more cases, higher ceilings) until it passes, then rerun. Do not weaken a check.

- [ ] **Step 8: Run the Python test to see it pass**

Run: `py reference/test_reference.py`
Expected: `Ran 2 tests ... OK`.

- [ ] **Step 9: Write `reference/README.md`**

```markdown
# Reference engine and golden files

`python/engine.py` is the validated Python planning engine, copied unchanged. The web engine in
`src/engine/` must give the same plan.

- `py reference/export_golden.py` runs 16 synthetic scenarios (`scenarios.py`) through the Python engine
  and writes `golden/*.json`: the input and the complete result of each. The files are committed.
- `py reference/test_reference.py` checks that each scenario exercises what it is for and that the committed
  golden files are current.
- `src/engine/golden.test.ts` runs the web engine on the same inputs and compares.
- `py reference/export_ds1_local.py` exports real data into `reference-local/`, which Git ignores. Run it only
  on the owner's PC. Never commit that folder.

Everything in `scenarios.py` is invented: a made-up region and made-up names.
```

- [ ] **Step 10: Add the Python check to the pipeline**

In `.github/workflows/ci.yml`, add this step after `- run: npm run test:coverage`:
```yaml
      - run: python3 -m unittest discover -s reference -p "test_*.py"
```

- [ ] **Step 11: Check the size and the contents, then commit**

Run: `du -sh reference/golden` (Git Bash) or check the files are each under 1 MB.
Run: `git status --short`
Expected: only the files of this task. No `reference-local/`.
```bash
git add reference .github/workflows/ci.yml
git commit -m "test: add Python reference engine, synthetic scenarios and golden files" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The planner, the golden test (the moment of truth)

**Files:**
- Create: `src/engine/testing/compare.ts`
- Create: `src/engine/golden.test.ts`
- Create: `src/engine/plan.test.ts`
- Create: `src/engine/raw.ts`
- Create: `src/engine/plan.ts`
- Create: `src/engine/finalise.ts`
- Create: `src/engine/index.ts`

**Interfaces:**
- Consumes: everything from Tasks 2 to 6; the golden files from Task 7.
- Produces (`raw.ts`): `interface RawResult { date: Map<number, number>; tech: Map<number, number>; visit: Map<number, number>; why: Map<number, string>; prevKm: Map<number, number>; travelMin: Map<number, number>; eta: Map<number, string>; flag: Map<number, string>; days: number[]; routes: Map<number, Map<number, Route>>; unscheduled: Set<number>; unschedReason: Map<number, string> }` (keys are case indexes, technician indexes or day numbers) and `newRaw(): RawResult`.
- Produces (`plan.ts`): `runPlan(ctx: Ctx): RawResult`.
- Produces (`finalise.ts`): `finalise(ctx: Ctx, res: RawResult): void`.
- Produces (`index.ts`): `plan(input: PlanInput): PlanResult`, and `export type * from './types'`.
- Produces (`testing/compare.ts`): `compareResults(actual: PlanResult, expected: PlanResult): string[]`, an empty array meaning identical.

- [ ] **Step 1: Write `src/engine/testing/compare.ts`**

```ts
import type { PlanResult } from '../types'

const EPS = 1e-9

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b))
}

/** Lists the differences between a computed and an expected result (at most 25). An empty list means identical. */
export function compareResults(actual: PlanResult, expected: PlanResult): string[] {
  const out: string[] = []
  const add = (msg: string): void => {
    if (out.length < 25) out.push(msg)
  }
  if (actual.scheduled.length !== expected.scheduled.length) {
    add(`scheduled count ${actual.scheduled.length} != ${expected.scheduled.length}`)
  }
  const n = Math.min(actual.scheduled.length, expected.scheduled.length)
  for (let i = 0; i < n; i++) {
    const a = actual.scheduled[i]
    const e = expected.scheduled[i]
    for (const key of ['id', 'day', 'tech', 'visit', 'eta', 'why', 'flag'] as const) {
      if (a[key] !== e[key]) add(`case ${e.id}: ${key} ${JSON.stringify(a[key])} != ${JSON.stringify(e[key])}`)
    }
    for (const key of ['travelMin', 'prevKm'] as const) {
      if (!close(a[key], e[key])) add(`case ${e.id}: ${key} ${a[key]} != ${e[key]}`)
    }
  }
  if (JSON.stringify(actual.unscheduled) !== JSON.stringify(expected.unscheduled)) {
    add(`unscheduled ${JSON.stringify(actual.unscheduled)} != ${JSON.stringify(expected.unscheduled)}`)
  }
  if (JSON.stringify(actual.days) !== JSON.stringify(expected.days)) {
    add(`days ${JSON.stringify(actual.days)} != ${JSON.stringify(expected.days)}`)
  }
  if (actual.routes.length !== expected.routes.length) {
    add(`route count ${actual.routes.length} != ${expected.routes.length}`)
  }
  const m = Math.min(actual.routes.length, expected.routes.length)
  for (let i = 0; i < m; i++) {
    const a = actual.routes[i]
    const e = expected.routes[i]
    const where = `route day ${e.day} technician ${e.tech}`
    if (a.day !== e.day || a.tech !== e.tech) add(`${where}: found day ${a.day} technician ${a.tech}`)
    if (JSON.stringify(a.stops) !== JSON.stringify(e.stops)) {
      add(`${where}: stops ${JSON.stringify(a.stops)} != ${JSON.stringify(e.stops)}`)
    }
    for (const key of ['travelMin', 'serviceMin', 'load'] as const) {
      if (!close(a[key], e[key])) add(`${where}: ${key} ${a[key]} != ${e[key]}`)
    }
  }
  return out
}
```

- [ ] **Step 2: Write the golden test (it will fail until the engine exists)**

`src/engine/golden.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { plan } from './index'
import { compareResults } from './testing/compare'
import type { PlanInput, PlanResult } from './types'

interface Golden {
  name: string
  input: PlanInput
  expected: PlanResult
}

const files = import.meta.glob('../../reference/golden/*.json', { eager: true, import: 'default' }) as Record<string, Golden>
const goldens = Object.values(files).sort((a, b) => a.name.localeCompare(b.name))

describe('golden files from the Python reference engine', () => {
  it('finds all 16 scenarios', () => {
    expect(goldens.length).toBe(16)
  })

  it.each(goldens.map((g) => [g.name, g] as const))('%s gives an identical plan', (_name, g) => {
    expect(compareResults(plan(g.input), g.expected)).toEqual([])
  })
})
```

- [ ] **Step 3: Write the smoke tests (they will fail until the engine exists)**

`src/engine/plan.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { dayNumber } from './calendar'
import { plan } from './index'
import { START, testInput, testSettings } from './testing/fixtures'

const here = { name: 'Here', lat: 20, lon: 30 } // exactly at the base
const tech = (name: string, skills: number[]) => ({ name, skills, active: true })
const aCase = (id: string, workType: number, extra: object = {}) => ({
  id, workType, place: 0, escalated: false, reportedDay: START, ...extra,
})

describe('plan (hand-checked cases; the golden files do the rigorous work)', () => {
  it('schedules one case with a plain-language reason', () => {
    const r = plan(testInput({ places: [here], technicians: [tech('Technician 01', [0])], cases: [aCase('1', 0)] }))
    expect(r.scheduled).toEqual([{
      id: '1', day: START, tech: 0, visit: 1, eta: '09:05', travelMin: 5, prevKm: 0, flag: '',
      why: 'Skill match (Technician 01 approved for Installation); adds 10 min detour; route of 1 stop in Central',
    }])
    expect(r.unscheduled).toEqual([])
    expect(r.days).toEqual([START])
  })

  it('leaves a case unscheduled when nobody has the skill', () => {
    const r = plan(testInput({ places: [here], technicians: [tech('T', [1])], cases: [aCase('1', 0)] }))
    expect(r.scheduled).toEqual([])
    expect(r.unscheduled).toEqual([{ id: '1', reason: 'No active technician has this skill' }])
  })

  it('skips the rest day', () => {
    const sunday = dayNumber('2026-10-18')
    const r = plan(testInput({
      settings: testSettings({ startDay: sunday }), places: [here], technicians: [tech('T', [0])], cases: [aCase('1', 0)],
    }))
    expect(r.scheduled[0].day).toBe(dayNumber('2026-10-19'))
  })

  it('moves what exceeds the daily ceiling to the next working day', () => {
    const cases = ['1', '2', '3', '4'].map((id) => aCase(id, 0))
    const r = plan(testInput({ places: [here], technicians: [tech('T', [0])], cases }))
    expect(r.scheduled.filter((s) => s.day === START).length).toBe(3)
    expect(r.scheduled.filter((s) => s.day === START + 1).length).toBe(1)
  })

  it('plans an escalated case first even when it comes last', () => {
    const cases = [aCase('1', 0), aCase('2', 0), aCase('3', 0), aCase('4', 0, { escalated: true })]
    const r = plan(testInput({ places: [here], technicians: [tech('T', [0])], cases }))
    expect(r.scheduled.find((s) => s.id === '4')?.day).toBe(START)
  })

  it('places a pinned case on its day with the manual technician', () => {
    const r = plan(testInput({
      places: [here],
      technicians: [tech('T0', [0]), tech('T1', [0])],
      cases: [aCase('1', 0, { pinnedTech: 1, earliestDay: START + 1 })],
    }))
    expect(r.scheduled[0]).toMatchObject({ day: START + 1, tech: 1, why: 'Manual assignment' })
  })

  it('waits for a technician to come back from leave', () => {
    const r = plan(testInput({
      places: [here],
      technicians: [{ ...tech('T', [0]), leaveFrom: START, leaveTo: START }],
      cases: [aCase('1', 0)],
    }))
    expect(r.scheduled[0].day).toBe(START + 1)
  })

  it('reports what does not fit inside the planning horizon', () => {
    const cases = ['1', '2', '3', '4'].map((id) => aCase(id, 0))
    const r = plan(testInput({
      settings: testSettings({ horizonDays: 1 }), places: [here], technicians: [tech('T', [0])], cases,
    }))
    expect(r.unscheduled).toEqual([{
      id: expect.any(String),
      reason: 'Beyond planning horizon (1 working days) or does not fit in a day',
    }])
  })

  it('rejects invalid input with a message that names the field', () => {
    expect(() => plan(testInput({ places: [{ name: 'P', lat: NaN, lon: 0 }] }))).toThrow('places[0].lat')
  })
})
```

- [ ] **Step 4: Run both to see them fail**

Run: `npx vitest run src/engine/golden.test.ts src/engine/plan.test.ts`
Expected: FAIL, cannot resolve `./index`.

- [ ] **Step 5: Write `src/engine/raw.ts`**

```ts
import type { Route } from './route'

/** The planner's working result: the Python Result as Maps. Keys are case indexes unless stated. */
export interface RawResult {
  date: Map<number, number>
  tech: Map<number, number>
  visit: Map<number, number>
  why: Map<number, string>
  prevKm: Map<number, number>
  travelMin: Map<number, number>
  eta: Map<number, string>
  flag: Map<number, string>
  days: number[]
  /** day number -> technician index -> route. Insertion order is technician order. */
  routes: Map<number, Map<number, Route>>
  unscheduled: Set<number>
  unschedReason: Map<number, string>
}

export function newRaw(): RawResult {
  return {
    date: new Map(),
    tech: new Map(),
    visit: new Map(),
    why: new Map(),
    prevKm: new Map(),
    travelMin: new Map(),
    eta: new Map(),
    flag: new Map(),
    days: [],
    routes: new Map(),
    unscheduled: new Set(),
    unschedReason: new Map(),
  }
}
```

- [ ] **Step 6: Write `src/engine/plan.ts`**

```ts
import { isAvailable, makeCalendar } from './calendar'
import type { Ctx } from './context'
import { finalise } from './finalise'
import { orderRoute } from './order'
import { newRaw, type RawResult } from './raw'
import { bestInsert, fits, recalc, Route, travelOf } from './route'

function removeFirst(a: number[], x: number): void {
  const i = a.indexOf(x)
  if (i >= 0) a.splice(i, 1)
}

function canDo(ctx: Ctx, t: number, c: number): boolean {
  return ctx.technicians[t].skills.includes(ctx.workTypes[ctx.cases[c].workType].requiredSkill)
}

/** Greedy cheapest insertion: repeatedly take the best-scoring feasible (case, technician) pair. */
function greedy(
  ctx: Ctx,
  routes: Map<number, Route>,
  pool: number[],
  left: number[],
  eligible: Map<number, number[]>,
  day: number,
): void {
  const nTech = ctx.technicians.length
  const cache = new Map<number, { ver: number; d: number; p: number }>()
  for (;;) {
    let bestScore = Infinity
    let bc = -1
    let bt = -1
    let bp = 0
    for (const c of pool) {
      const cs = ctx.cases[c]
      const age = Math.min(90.0, Math.max(0.0, day - cs.reportedDay))
      const bonus = age * ctx.s.ageWeight + (cs.escalated ? 100000.0 : 0.0)
      for (const t of eligible.get(c) ?? []) {
        const r = routes.get(t)
        if (r === undefined) continue
        const key = c * nTech + t
        let ent = cache.get(key)
        if (ent === undefined || ent.ver !== r.ver) {
          const { delta, pos } = bestInsert(ctx, r, c)
          ent = { ver: r.ver, d: delta, p: pos }
          cache.set(key, ent)
        }
        if (!fits(ctx, r, c, ent.d)) continue
        const score = ent.d + ctx.s.balanceWeight * (r.travel + r.service) - bonus
        if (score < bestScore) {
          bestScore = score
          bc = c
          bt = t
          bp = ent.p
        }
      }
    }
    if (bc < 0) break
    const rr = routes.get(bt)
    if (rr === undefined) break
    rr.stops.splice(bp, 0, bc)
    recalc(ctx, rr)
    removeFirst(pool, bc)
    removeFirst(left, bc)
  }
}

/** Moves cases between routes while that saves travel (up to 20 rounds). */
function relocate(ctx: Ctx, routes: Map<number, Route>, eligible: Map<number, number[]>): void {
  for (let round = 0; round < 20; round++) {
    let bestGain = 0.5
    let bc = -1
    let frm = -1
    let to = -1
    let bp = 0
    for (const [k, r] of routes) {
      if (r.pinned) continue
      for (const c of r.stops) {
        const without = r.stops.filter((x) => x !== c)
        const saved = r.travel - travelOf(ctx, without)
        for (const t of eligible.get(c) ?? []) {
          const target = routes.get(t)
          if (t === k || target === undefined || target.pinned) continue
          const { delta, pos } = bestInsert(ctx, target, c)
          if (!fits(ctx, target, c, delta)) continue
          const gain = saved - delta
          if (gain > bestGain) {
            bestGain = gain
            bc = c
            frm = k
            to = t
            bp = pos
          }
        }
      }
    }
    if (bc < 0) return
    const from = routes.get(frm)
    const dest = routes.get(to)
    if (from === undefined || dest === undefined) return
    removeFirst(from.stops, bc)
    recalc(ctx, from)
    dest.stops.splice(bp, 0, bc)
    recalc(ctx, dest)
    orderRoute(ctx, from)
    orderRoute(ctx, dest)
  }
}

/** Plans day by day from the start day. Returns the raw result (before conversion to the public shape). */
export function runPlan(ctx: Ctx): RawResult {
  const res = newRaw()
  const { s, cases, technicians } = ctx
  const cal = makeCalendar(s)
  const left: number[] = cases.map((_, i) => i)
  const eligible = new Map<number, number[]>()
  for (let c = 0; c < cases.length; c++) {
    let l: number[] = []
    for (let t = 0; t < technicians.length; t++) {
      if (technicians[t].active && canDo(ctx, t, c)) l.push(t)
    }
    const req = cases[c].pinnedTech ?? -1
    if (req >= 0) l = l.filter((x) => x === req)
    eligible.set(c, l)
    if (l.length === 0) {
      removeFirst(left, c)
      res.unscheduled.add(c)
      res.unschedReason.set(
        c,
        req >= 0 ? 'Manual technician is not approved for this work type' : 'No active technician has this skill',
      )
    }
  }

  let day = s.startDay
  let worked = 0
  let guard = 0
  while (left.length > 0 && worked < s.horizonDays && guard < 2000) {
    guard += 1
    if (!cal.isWorkday(day)) {
      day += 1
      continue
    }
    worked += 1
    const routes = new Map<number, Route>()
    for (let t = 0; t < technicians.length; t++) {
      if (isAvailable(technicians[t], day)) routes.set(t, new Route())
    }
    const pool = left.filter((c) => {
      const md = cases[c].earliestDay
      return !(md !== undefined && md > day)
    })
    for (const c of [...pool]) {
      const cs = cases[c]
      const req = cs.pinnedTech ?? -1
      const frz = cs.frozenTech ?? -1
      let pt = -1
      if (req >= 0 && cs.earliestDay !== undefined && cs.earliestDay === day) pt = req
      else if (frz >= 0 && day === s.startDay) pt = frz
      if (pt < 0 || !canDo(ctx, pt, c)) continue
      const r = routes.get(pt)
      if (r === undefined) continue
      const { pos } = bestInsert(ctx, r, c)
      r.stops.splice(pos, 0, c)
      recalc(ctx, r)
      r.pinned = true
      removeFirst(pool, c)
      removeFirst(left, c)
      res.why.set(c, req >= 0 && cs.earliestDay !== undefined ? 'Manual assignment' : 'Kept from earlier plan (frozen)')
      res.tech.set(c, pt)
      res.date.set(c, day)
    }
    for (let pass = 0; pass < 3; pass++) {
      greedy(ctx, routes, pool, left, eligible, day)
      for (const r of routes.values()) orderRoute(ctx, r)
      relocate(ctx, routes, eligible)
    }
    greedy(ctx, routes, pool, left, eligible, day)
    for (const r of routes.values()) orderRoute(ctx, r)
    res.days.push(day)
    res.routes.set(day, routes)
    for (const [t, r] of routes) {
      for (const c of r.stops) {
        res.date.set(c, day)
        res.tech.set(c, t)
      }
    }
    day += 1
  }
  for (const c of left) {
    res.unscheduled.add(c)
    if (!res.unschedReason.has(c)) {
      res.unschedReason.set(c, `Beyond planning horizon (${s.horizonDays} working days) or does not fit in a day`)
    }
  }
  finalise(ctx, res)
  return res
}
```

- [ ] **Step 7: Write `src/engine/finalise.ts`**

```ts
import type { Ctx } from './context'
import { haversineKm } from './geo'
import { formatClock, pyInt, pyRound } from './pymath'
import type { RawResult } from './raw'
import { recalc } from './route'

/** Arrival times, visit numbers, kilometres from the previous stop and the plain-language reasons. */
export function finalise(ctx: Ctx, res: RawResult): void {
  const s = ctx.s
  const tm = ctx.geo.tm
  for (const day of res.days) {
    for (const [t, r] of res.routes.get(day) ?? []) {
      recalc(ctx, r)
      let clock = s.dayStartMin
      let brk = false
      let prev = 0
      if (r.travel + r.service > s.usableMin + 1e-6) {
        for (const c of r.stops) res.flag.set(c, 'OVER CAPACITY')
      }
      for (let i = 0; i < r.stops.length; i++) {
        const c = r.stops[i]
        const node = ctx.caseNode[c]
        const nxt = i + 1 < r.stops.length ? ctx.caseNode[r.stops[i + 1]] : 0
        const tmin = tm[prev][node]
        clock += tmin
        if (!brk && clock >= s.lunchStartMin) {
          clock += s.breakMin
          brk = true
        }
        res.eta.set(c, formatClock(clock))
        res.travelMin.set(c, tmin)
        res.visit.set(c, i + 1)
        const wt = ctx.workTypes[ctx.cases[c].workType]
        clock += wt.serviceMin
        prev = node
        const pn = i === 0 ? 0 : ctx.caseNode[r.stops[i - 1]]
        const detour = tm[pn][node] + tm[node][nxt] - tm[pn][nxt]
        if (!res.why.has(c)) {
          const extra = detour < 1 ? 'no extra travel' : `adds ${pyInt(pyRound(detour))} min detour`
          const stops = `${r.stops.length} stop${r.stops.length > 1 ? 's' : ''}`
          res.why.set(
            c,
            `Skill match (${ctx.technicians[t].name} approved for ${wt.name}); ${extra}; route of ${stops} in ${ctx.geo.zone[ctx.cases[c].place]}`,
          )
        }
      }
    }
  }
  for (const day of res.days) {
    for (const r of res.routes.get(day)?.values() ?? []) {
      let prevPlace = -1
      for (const c of r.stops) {
        const a = ctx.cases[c].place
        let km: number
        if (prevPlace < 0) {
          km = ctx.geo.areaKm[a] * s.roadFactor
        } else if (prevPlace === a) {
          km = 0.0
        } else {
          const p = ctx.places[prevPlace]
          const q = ctx.places[a]
          km = haversineKm(p.lat, p.lon, q.lat, q.lon) * s.roadFactor
        }
        res.prevKm.set(c, km)
        prevPlace = a
      }
    }
  }
}
```

- [ ] **Step 8: Write `src/engine/index.ts`**

```ts
import { checkInput } from './check'
import { buildContext, type Ctx } from './context'
import { runPlan } from './plan'
import type { RawResult } from './raw'
import type { PlanInput, PlanResult, RouteSummary, ScheduledCase } from './types'

export type * from './types'

function toPlanResult(ctx: Ctx, raw: RawResult): PlanResult {
  const scheduled: ScheduledCase[] = []
  ctx.cases.forEach((c, i) => {
    const day = raw.date.get(i)
    const tech = raw.tech.get(i)
    if (day === undefined || tech === undefined) return
    scheduled.push({
      id: c.id,
      day,
      tech,
      visit: raw.visit.get(i) ?? 0,
      eta: raw.eta.get(i) ?? '',
      travelMin: raw.travelMin.get(i) ?? 0,
      prevKm: raw.prevKm.get(i) ?? 0,
      why: raw.why.get(i) ?? '',
      flag: raw.flag.get(i) ?? '',
    })
  })
  const unscheduled = [...raw.unscheduled]
    .sort((a, b) => a - b)
    .map((i) => ({ id: ctx.cases[i].id, reason: raw.unschedReason.get(i) ?? '' }))
  const routes: RouteSummary[] = []
  for (const day of raw.days) {
    for (const [tech, r] of raw.routes.get(day) ?? []) {
      routes.push({
        day,
        tech,
        stops: r.stops.map((c) => ctx.cases[c].id),
        travelMin: r.travel,
        serviceMin: r.service,
        load: r.frac,
      })
    }
  }
  return { scheduled, unscheduled, days: [...raw.days], routes }
}

/** Plans the cases of one input. The same input always gives the same result. Throws on invalid input. */
export function plan(input: PlanInput): PlanResult {
  checkInput(input)
  const ctx = buildContext(input)
  return toPlanResult(ctx, runPlan(ctx))
}
```

- [ ] **Step 9: Run the smoke tests**

Run: `npx vitest run src/engine/plan.test.ts`
Expected: all 9 pass. A failure here is a porting mistake in `plan.ts` or `finalise.ts`: compare the failing behaviour line by line with `reference/python/engine.py` (`plan`, `greedy`, `relocate`, `finalise`).

- [ ] **Step 10: Run the golden test**

Run: `npx vitest run src/engine/golden.test.ts`
Expected: 17 tests pass (the count check plus 16 scenarios).

If a scenario fails, `compareResults` prints up to 25 differences. Work through these causes in this order, rerunning after each fix:
1. Rounding: a wrong arrival time or detour text points at `pyRound` or `formatClock`.
2. Tie-breaking: a different technician or stop order for equal scores points at loop order or a non-strict comparison.
3. Arithmetic order: tiny differences that flip a choice point at a reordered formula. Compare the expression with Python term by term.
4. Distance maths: if only the last digits differ and the plan still diverges, stop. This is the known risk in the spec (section 12). Do not change `reference/python/engine.py` or add rounding on your own. Record the scenario name, the first differences and the two values, and report to the project owner.

- [ ] **Step 11: Lint, type check, commit**

Run: `npm run lint` then `npx tsc -b`
Expected: clean.
```bash
git add src/engine
git commit -m "feat(engine): port the planner and finalise step, identical to the Python golden files" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Safety-rule tests (invariants and properties)

**Files:**
- Create: `src/engine/testing/invariants.ts`
- Test: `src/engine/invariants.test.ts`

**Interfaces:**
- Consumes: `plan`, types, `generateInput`, `makeCalendar`, `isAvailable`.
- Produces: `checkInvariants(input: PlanInput, result: PlanResult): string[]`, an empty array meaning all of INV-1 (completeness), INV-2 (skill), INV-3 (capacity and ceilings), INV-4 (calendar and availability), INV-6 (explanation) hold. INV-5 (determinism) is checked in the test itself. Assumes the input has no manual pins.

- [ ] **Step 1: Write the failing test**

`src/engine/invariants.test.ts`:
```ts
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { plan } from './index'
import { generateInput } from './testing/generate'
import { checkInvariants } from './testing/invariants'

describe('safety rules hold on random inputs', () => {
  it('INV-1 to INV-6: nothing lost, right skill, within capacity, working days only, same plan twice, every decision explained', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 0, max: 30 }),
        (seed, nPlaces, nTechs, nCases) => {
          const input = generateInput(seed, nPlaces, nTechs, nCases)
          const result = plan(input)
          expect(checkInvariants(input, result)).toEqual([])
          expect(plan(input)).toEqual(result) // INV-5: determinism
        },
      ),
      { numRuns: 200 },
    )
  })

  it('catches a planted violation (the checker itself works)', () => {
    const input = generateInput(7, 4, 6, 20)
    const result = plan(input)
    expect(result.scheduled.length).toBeGreaterThan(0)
    const broken = { ...result, scheduled: result.scheduled.map((s, i) => (i === 0 ? { ...s, tech: (s.tech + 1) % 6, why: '' } : s)) }
    expect(checkInvariants(input, broken).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/engine/invariants.test.ts`
Expected: FAIL, cannot resolve `./testing/invariants`.

- [ ] **Step 3: Write `src/engine/testing/invariants.ts`**

```ts
import { isAvailable, makeCalendar } from '../calendar'
import type { PlanInput, PlanResult } from '../types'

/** Checks the safety rules on a result. Assumes the input has no manual pins. Returns the problems found. */
export function checkInvariants(input: PlanInput, result: PlanResult): string[] {
  const problems: string[] = []
  const byId = new Map(input.cases.map((c) => [c.id, c]))
  const cal = makeCalendar(input.settings)

  // INV-1: every case is in exactly one list
  const seen = new Map<string, number>()
  for (const s of result.scheduled) seen.set(s.id, (seen.get(s.id) ?? 0) + 1)
  for (const u of result.unscheduled) seen.set(u.id, (seen.get(u.id) ?? 0) + 1)
  for (const c of input.cases) {
    if (seen.get(c.id) !== 1) problems.push(`INV-1: case ${c.id} appears ${seen.get(c.id) ?? 0} times`)
  }

  for (const s of result.scheduled) {
    const c = byId.get(s.id)
    const tech = input.technicians[s.tech]
    if (c === undefined || tech === undefined) {
      problems.push(`INV-1: scheduled case ${s.id} or technician ${s.tech} does not exist`)
      continue
    }
    // INV-2: the technician holds the skill the work type requires
    if (!tech.skills.includes(input.workTypes[c.workType].requiredSkill)) {
      problems.push(`INV-2: ${tech.name} lacks the skill for case ${s.id}`)
    }
    // INV-4: a working day, and the technician is available
    if (!cal.isWorkday(s.day)) problems.push(`INV-4: case ${s.id} is on a rest day or holiday (day ${s.day})`)
    if (!isAvailable(tech, s.day)) problems.push(`INV-4: ${tech.name} is not available on day ${s.day}`)
    // INV-6: a reason
    if (s.why === '') problems.push(`INV-6: case ${s.id} has no reason`)
  }
  for (const u of result.unscheduled) {
    if (u.reason === '') problems.push(`INV-6: unscheduled case ${u.id} has no reason`)
  }

  // INV-3: within usable minutes and the daily ceilings
  for (const r of result.routes) {
    if (r.travelMin + r.serviceMin > input.settings.usableMin + 1e-6) {
      problems.push(`INV-3: technician ${r.tech} on day ${r.day} uses ${r.travelMin + r.serviceMin} minutes`)
    }
    const counts = new Map<number, number>()
    for (const id of r.stops) {
      const wt = byId.get(id)?.workType ?? 0
      counts.set(wt, (counts.get(wt) ?? 0) + 1)
    }
    for (const [wt, n] of counts) {
      if (n > input.workTypes[wt].dailyCeiling + 1e-9) {
        problems.push(`INV-3: technician ${r.tech} on day ${r.day} has ${n} cases of work type ${wt}`)
      }
    }
  }
  return problems
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/engine/invariants.test.ts`
Expected: both tests pass. If the property test fails, fast-check prints the failing seed and sizes. Reproduce with `generateInput(<seed>, <places>, <techs>, <cases>)`, read the problems list, and fix the engine (not the checker) unless the checker is demonstrably wrong.

- [ ] **Step 5: Lint, type check, commit**

Run: `npm run lint` then `npx tsc -b`
Expected: clean.
```bash
git add src/engine/testing/invariants.ts src/engine/invariants.test.ts
git commit -m "test(engine): add safety-rule invariants and property tests" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Real data (DS-1) export and the local-only test

**Files:**
- Create: `reference/export_ds1_local.py`
- Create: `src/engine/ds1.local.test.ts`
- Output (not committed): `reference-local/ds1_baseline.json`, `reference-local/ds1_first_technician_inactive.json`

**Interfaces:**
- Consumes: `to_input`, `to_python`, `from_python` from `reference/convert.py`; the existing project `AC_Scheduler_Python` (its `pipeline.run`, `seed`, `CsvStore`, `Engine`).
- Produces: two golden files in the same shape as the synthetic ones, in the git-ignored folder `reference-local/`; a Vitest test that runs only when that folder holds files.

- [ ] **Step 1: Write the local-only test**

`src/engine/ds1.local.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { plan } from './index'
import { compareResults } from './testing/compare'
import type { PlanInput, PlanResult } from './types'

interface Golden {
  name: string
  input: PlanInput
  expected: PlanResult
}

// Real data of the owner's service center. The folder is git-ignored and exists only on the owner's PC.
const files = import.meta.glob('../../reference-local/*.json', { eager: true, import: 'default' }) as Record<string, Golden>
const goldens = Object.values(files).sort((a, b) => a.name.localeCompare(b.name))

describe.skipIf(goldens.length === 0)('DS-1, real data (local only)', () => {
  it('has the baseline and the one-technician-inactive plan', () => {
    expect(goldens.map((g) => g.name)).toEqual(['ds1_baseline', 'ds1_first_technician_inactive'])
  })

  it.each(goldens.map((g) => [g.name, g] as const))('%s gives an identical plan', (_name, g) => {
    expect(compareResults(plan(g.input), g.expected)).toEqual([])
  })
})
```

- [ ] **Step 2: Write `reference/export_ds1_local.py`**

```python
"""Exports the real DS-1 plans into a git-ignored folder. Run it on the owner's PC only: the files hold real names.

Usage:
  py reference/export_ds1_local.py --project "<AC_Scheduler_Python folder>" --inputs "<folder with the DS-1 files>"
"""
import argparse
import copy
import datetime as dt
import json
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from convert import engine, from_python, to_input, to_python  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True, help="folder of the AC_Scheduler_Python project")
    ap.add_argument("--inputs", required=True, help="folder with the case CSV and the location file")
    ap.add_argument("--out", default=str(HERE.parent / "reference-local"))
    a = ap.parse_args()

    sys.path.insert(0, a.project)
    from ac_scheduler.engine import Engine as ProjectEngine
    from ac_scheduler.pipeline import run
    from ac_scheduler.seed import seed
    from ac_scheduler.stores import CsvStore

    captured = []
    original = ProjectEngine.plan

    def spy(self):
        res = original(self)
        captured.append((self, res))
        return res

    ProjectEngine.plan = spy
    try:
        with tempfile.TemporaryDirectory() as tmp:
            store = CsvStore(tmp)
            seed(store, force=True)
            run(store, a.inputs, dt.datetime(2026, 10, 13))
    finally:
        ProjectEngine.plan = original
    assert len(captured) == 1, "expected exactly one plan() call, got %d" % len(captured)

    project_eng, project_res = captured[0]
    inp = to_input(project_eng)
    expected = from_python(project_eng, project_res)

    # The committed reference copy must give the same plan as the project's own engine.
    ref_eng = to_python(inp)
    assert from_python(ref_eng, ref_eng.plan()) == expected, "reference/python/engine.py differs from the project engine"

    inactive = copy.deepcopy(inp)
    inactive["technicians"][0]["active"] = False
    inactive_eng = to_python(inactive)
    inactive_expected = from_python(inactive_eng, inactive_eng.plan())

    out = Path(a.out)
    out.mkdir(exist_ok=True)
    for name, i, e in (("ds1_baseline", inp, expected), ("ds1_first_technician_inactive", inactive, inactive_expected)):
        (out / (name + ".json")).write_text(json.dumps({"name": name, "input": i, "expected": e}, separators=(",", ":")), encoding="utf-8")
        print("%-32s %3d scheduled, %2d unscheduled, %d days" % (name, len(e["scheduled"]), len(e["unscheduled"]), len(e["days"])))
    print("Written to", out)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2b: Check the new test is skipped while the folder is empty**

Run: `npx vitest run src/engine/ds1.local.test.ts`
Expected: the file is reported as skipped (0 passed, tests skipped), not as passed.

- [ ] **Step 3: Export the real data (on the owner's PC)**

Run:
```bash
py reference/export_ds1_local.py --project "C:/Users/lenovo/OneDrive - iitkgp.ac.in/Desktop/HW/AC_Scheduler_Python" --inputs "C:/Users/lenovo/OneDrive - iitkgp.ac.in/Desktop/HW/AC_Scheduler_Python/inputs"
```
Expected output (the baseline numbers are from the validated run):
```
ds1_baseline                     243 scheduled,  0 unscheduled, 7 days
ds1_first_technician_inactive    ... scheduled, ... unscheduled, ... days
Written to ...reference-local
```
If the baseline does not say `243 scheduled, 0 unscheduled, 7 days`, stop and report: the inputs folder or the Python project is not the validated one.

- [ ] **Step 4: Check that Git ignores the folder**

Run: `git status --short`
Expected: no line mentioning `reference-local`. Run `git check-ignore -v reference-local/ds1_baseline.json`, expected: a line naming `.gitignore` and the rule `/reference-local/`.

- [ ] **Step 5: Run the real-data test**

Run: `npx vitest run src/engine/ds1.local.test.ts`
Expected: 3 tests pass (the name check plus both plans identical). If a plan differs, handle it as in Task 8 step 10 (rounding, tie-breaking, arithmetic order, then report).

- [ ] **Step 6: Commit (code only)**

```bash
git add reference/export_ds1_local.py src/engine/ds1.local.test.ts
git status --short
git commit -m "test: add local-only real-data comparison for DS-1" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
Before committing, confirm `git status --short` shows only those two files.

---

### Task 11: Worker wrapper

**Files:**
- Create: `src/worker/handler.ts`
- Create: `src/worker/plan.worker.ts`
- Create: `src/worker/client.ts`
- Test: `src/worker/handler.test.ts`

**Interfaces:**
- Consumes: `plan`, `PlanInput`, `PlanResult` from `../engine`.
- Produces: `type PlanReply = { ok: true; result: PlanResult } | { ok: false; error: string }`; `handlePlanRequest(input: PlanInput): PlanReply` (never throws); `planInWorker(input: PlanInput): Promise<PlanResult>` (rejects with an `Error` carrying the engine's message).

- [ ] **Step 1: Write the failing test**

`src/worker/handler.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { START, testInput } from '../engine/testing/fixtures'
import { handlePlanRequest } from './handler'

describe('handlePlanRequest', () => {
  it('returns the plan on valid input', () => {
    const input = testInput({
      places: [{ name: 'Here', lat: 20, lon: 30 }],
      technicians: [{ name: 'T', skills: [0], active: true }],
      cases: [{ id: '1', workType: 0, place: 0, escalated: false, reportedDay: START }],
    })
    const reply = handlePlanRequest(input)
    expect(reply.ok).toBe(true)
    if (reply.ok) expect(reply.result.scheduled.length).toBe(1)
  })

  it('returns the message instead of throwing on invalid input', () => {
    const reply = handlePlanRequest(testInput({ places: [{ name: 'P', lat: NaN, lon: 0 }] }))
    expect(reply).toEqual({ ok: false, error: 'Invalid planning input: places[0].lat must be a finite number' })
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/worker/handler.test.ts`
Expected: FAIL, cannot resolve `./handler`.

- [ ] **Step 3: Write `src/worker/handler.ts`**

```ts
import { plan, type PlanInput, type PlanResult } from '../engine'

export type PlanReply = { ok: true; result: PlanResult } | { ok: false; error: string }

/** The work of the worker, as a plain function so that it can be tested without a browser. */
export function handlePlanRequest(input: PlanInput): PlanReply {
  try {
    return { ok: true, result: plan(input) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
```

- [ ] **Step 4: Write `src/worker/plan.worker.ts`**

```ts
import type { PlanInput } from '../engine'
import { handlePlanRequest } from './handler'

// The worker scope; typed by hand because this project's TypeScript config uses the DOM library.
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<PlanInput>) => void) | null
  postMessage: (message: unknown) => void
}

scope.onmessage = (e) => {
  scope.postMessage(handlePlanRequest(e.data))
}
```

- [ ] **Step 5: Write `src/worker/client.ts`**

```ts
import type { PlanInput, PlanResult } from '../engine'
import type { PlanReply } from './handler'

/** Plans in a Web Worker so that the screen stays responsive. Rejects with the engine's plain message on invalid input. */
export function planInWorker(input: PlanInput): Promise<PlanResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./plan.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<PlanReply>) => {
      worker.terminate()
      if (e.data.ok) resolve(e.data.result)
      else reject(new Error(e.data.error))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message))
    }
    worker.postMessage(input)
  })
}
```

- [ ] **Step 6: Run the test, lint, type check and build**

Run: `npx vitest run src/worker/handler.test.ts`
Expected: both pass.
Run: `npm run lint`, `npx tsc -b`, `npm run build`
Expected: all clean. (The worker is not used by the starter page yet, so the build does not bundle it; the screens piece wires it in.)

- [ ] **Step 7: Commit**

```bash
git add src/worker
git commit -m "feat(worker): add the planning worker wrapper" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: The step 1 gate (coverage, pipeline, spec update, review)

**Files:**
- Modify: `docs/superpowers/specs/2026-11-19-planning-engine-design.md`
- No new code.

- [ ] **Step 1: Run everything the pipeline runs**

Run, in order:
```bash
npm ci
npm run lint
npm run test:coverage
py reference/test_reference.py
npm run build
```
Expected: lint clean; all tests pass with the coverage table showing at least 90 percent statements and lines for `src/engine`; the Python test reports `OK`; the build succeeds. If coverage is below 90, read the uncovered lines in the table, add tests for them (not coverage-ignore comments), and rerun.

- [ ] **Step 2: Run the full test suite once with the real-data test visible**

Run: `npx vitest run`
Expected: every file passes; `ds1.local.test.ts` shows passed on the owner's PC (with `reference-local/` present). Record the counts.

- [ ] **Step 3: Update the spec to match what was built**

In `docs/superpowers/specs/2026-11-19-planning-engine-design.md`:
- Section 4, add these rows to the file table: `pymath.ts` (Python-compatible rounding, int, modulo, clock text), `context.ts` (the input plus precomputed geometry), `check.ts` (plain-language input check), `raw.ts` (the planner's working result), `testing/` (test support, excluded from coverage).
- Section 6, change `tests/reference/ds1.local.test.ts` to `src/engine/ds1.local.test.ts`, and add: "Tests sit next to their modules in `src/engine/`, so that the type check covers them. Golden files are read with Vite's `import.meta.glob`."
- Change the `Status:` line to `Status: step 1 implemented; step 2 plan not yet written`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-11-19-planning-engine-design.md
git commit -m "docs: align the engine design with what step 1 built" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Ask the project owner before pushing**

Show: the commit list (`git log --oneline origin/main..HEAD`), the test counts, the coverage numbers, and the DS-1 result. Push (`git push origin main`) only after the owner says yes. After the push, check that the GitHub pipeline run is green (`https://github.com/rudrakshk21/ac-service-scheduler/actions`).

- [ ] **Step 6: Gate result**

Step 1 is done when all of these hold: the 16 synthetic goldens pass in the pipeline; DS-1 baseline and first-technician-inactive are identical on the owner's PC; the invariant tests pass; engine coverage is at least 90 percent; the pipeline is green. Then, and only then, write the step 2 plan (generalisation, spec section 7), starting from the Python reference changes.
