# Planning engine: design

Date: 2026-11-19
Status: approved in conversation, awaiting written review
Part of: AC Service Scheduler, requirements v4.1 (build phase P2, milestone M3)

## 1. Purpose

Build the planning engine of the web application as a pure TypeScript module. Given cases, technicians,
places and settings, it assigns each case to a qualified technician and a working day, orders every
route, and explains each decision. It must reproduce the validated Python engine exactly, and then be
generalised step by step so that it works for any AC service center (requirements PL-7, PL-9 to PL-11).

This is the first of five pieces: engine, data intake and mapping, screens, phone/map/sharing, hardening.
This document covers the engine only.

## 2. Decisions taken with the project owner

| Question | Decision |
|---|---|
| How strict is "the same plan"? | Identical. Every discrete output equals the Python result. |
| How general is the first version? | Port first, then generalise in a second step. |
| Where does the real data go? | It stays on the owner's PC. The public pipeline uses synthetic data only. |
| How is the engine built? | Approach A: port the Python engine, checked by golden files. Rejected: converting the Apps Script engine (Google Sheets assumptions, tested on two scenarios only) and running Python in the browser (about 10 MB, breaks the Android and offline goals). |
| May the Python engine file be in the public repository? | Yes, under `reference/python/`. |

## 3. Boundary and interface

- Location: `src/engine/`. Pure TypeScript. No React, no browser APIs, no storage (NFR-14).
- One entry point: `plan(input: PlanInput): PlanResult`. Same input gives the same result (BR-19).
- Dates are whole day numbers counted from 1970-01-01. The caller converts calendar dates. The engine never
  reads a clock or a time zone (ADR-5).
- The engine never sorts. The order of `cases` and `technicians` in the input is the tie-break order,
  exactly as in Python. The caller sorts cases by numeric identifier.

Input, as plain JSON-serialisable data:

```ts
interface PlanInput {
  settings: {
    baseLat: number; baseLon: number;
    speedKmh: number; roadFactor: number; sameAreaHopMin: number;
    usableMin: number; dayStartMin: number; lunchStartMin: number; breakMin: number;
    ageWeight: number; balanceWeight: number; maxKm: number; horizonDays: number;
    restWeekdays: number[];           // 0 = Monday ... 6 = Sunday
    holidays: number[];               // day numbers
    startDay: number;
  };
  workTypes: { name: string; serviceMin: number; dailyCeiling: number; requiredSkill: number }[];
  technicians: { name: string; skills: number[]; active: boolean;
                 leaveFrom?: number; leaveTo?: number; startPlace?: number }[];
  places: { name: string; lat: number; lon: number }[];
  cases: { id: string; workType: number; place: number; escalated: boolean; reportedDay: number;
           pinnedTech?: number; earliestDay?: number; frozenTech?: number }[];
}
```

Output, with the same fields as the Python `Result`, per case: day, technician, visit number, arrival time
(`HH:MM`), travel minutes, kilometres from the previous stop, reason text and flag. Plus the routes per day
(stop order, travel, on-site time, load) and the unscheduled cases with a reason.

Step 1 keeps the Python behaviour: three work types, `requiredSkill` equal to the work type index, every
route starting and ending at the base, and `escalated` as the only priority flag. The data shape is already
general so that step 2 does not change the interface.

## 4. Files in `src/engine/`

| File | Job |
|---|---|
| `types.ts` | Input and output types |
| `calendar.ts` | Weekday from a day number, working-day and availability checks |
| `geo.ts` | Haversine distance, travel-time table between places, zones |
| `route.ts` | One technician's day: cheapest insertion, fit check, recalculation |
| `order.ts` | Best stop order: exact search up to 10 stops, 2-opt above |
| `plan.ts` | Day loop: pinned cases, greedy placement, relocation, roll-over |
| `finalise.ts` | Arrival times, visit numbers, kilometres, reason text |
| `index.ts` | Exports `plan` and the types |

Each file has a test file next to it. The Worker wrapper lives apart in `src/worker/` and only passes the
input in and the result out.

## 5. Rules that keep the port exact

1. Same loop order everywhere, and the same strict "less than" when choosing the best candidate.
2. Same constants and tolerances: 1e-6 in fit checks, the 100000 bonus for escalated cases, the age cap of
   90 days, 3 placement passes, 20 relocation rounds, 200 improvement rounds in 2-opt, gain threshold 0.5.
3. Same arithmetic order. No formula is simplified.
4. Python rounding: round half to even for arrival times, detour minutes and zones, implemented as a
   dedicated function. Integer conversion truncates toward zero, as in Python.
5. Ordered containers: JavaScript `Map` filled in the same order as the Python dictionaries.
6. Exact ordering up to 10 stops uses typed arrays and the same dynamic programme as Python.

## 6. Testing

Golden files. `reference/export_golden.py` (standard library only) runs `reference/python/engine.py` on
scenarios and writes each scenario's input and full result as JSON into `reference/golden/`. The
TypeScript test loads the same input, runs `plan`, and compares.

"Identical" in the test: every discrete output matches exactly (technician, day, visit, arrival time,
reason, flag, unscheduled cases and reasons, stop order of each route). Real-valued outputs (travel
minutes, kilometres) match within 1e-9.

Public scenarios, all synthetic, generated from a fixed seed over a fictional city:

- normal mid-size day with several technicians
- technician inactive; leave period
- holiday; rest day switched to a working day
- manual pins (technician plus date; earliest date); frozen plan
- escalated case
- routes with more than 10 stops (exercises 2-opt)
- unscheduled cases: no skill, manual technician not approved, beyond the horizon
- pin that overloads a day
- many identical places (tie-breaking)
- arrival times on exact half minutes (rounding)

Real data (DS-1) stays local. The exporter writes the 288-case plan and the technician-inactive plan into
`reference-local/`, which Git ignores. `tests/reference/ds1.local.test.ts` runs only when that folder exists.
In the public pipeline it is reported as skipped, never as passed.

Other tests: small unit tests per file (distance values, the rounding function, calendar edge cases,
Held-Karp compared with brute force on small inputs), and random-input tests with fast-check for the
invariants INV-1 to INV-6 (completeness, skill, capacity except recorded pins, calendar, determinism,
explanation).

Tools: Vitest with coverage (at least 90% for the engine, NFR-13) and fast-check.

## 7. Step 2: generalisation

Each feature is a small change to the Python reference first. The golden files are regenerated and every
earlier scenario must be unchanged. Then the same change is made in TypeScript. Order:

1. Work types and skills as free lists, ceiling per work type.
2. Start point per technician, defaulting to the base.
3. Working hours and breaks per technician.
4. Priority levels in place of the single escalated flag. The default two levels give identical results.
5. Due dates.
6. On-site time by product type, or a duration given in the case.

Certifications (FR-25.4) are lower priority and stay out of this piece.

## 8. Speed

Python plans the 243 schedulable cases of DS-1 in 0.2 seconds. The risk is the 2,000-case target (NFR-4):
the greedy step re-scans every case and technician pair after each placement. Measure first on a synthetic
2,000-case, 100-technician scenario. If it is too slow, optimise only in ways that leave the plan identical,
with the golden tests guarding each change. Not part of step 1.

## 9. Errors

- The engine does not throw on valid input and keeps the Python loop limits, so it cannot run forever.
- A small entry check rejects invalid input (place or technician index out of range, missing coordinate,
  negative minutes) with a plain message that names the field.
- Full import-time validation belongs to the data intake piece.

## 10. Out of this piece

File reading and mapping, screens, storage, the map, phone features. Only the thin Worker wrapper is included.

## 11. Finish line (gate P2, milestone M3)

- Synthetic golden tests pass in the public pipeline.
- On the owner's PC, DS-1 gives an identical plan for the baseline and for one technician inactive.
- Invariant tests pass. Engine coverage is at least 90%.
- Each step 2 feature has golden or unit tests.
- Pipeline green on GitHub.

Estimate: 3 to 4 working days for the port, 2 to 3 for step 2.

## 12. Risks

| Risk | Mitigation |
|---|---|
| `Math.sin`, `cos`, `asin` can differ from Python's in the last digit, which could flip a tie | The golden test shows it at once. Fix: round distances to the same precision in both engines and regenerate the goldens. Any change to the Python reference must leave the DS-1 plan unchanged |
| Python and JavaScript rounding differ | Dedicated Python-style rounding function with its own table test |
| Real data leaks into the public repository | Real data only in the ignored `reference-local/` folder. Golden scenarios are synthetic. Review every commit before pushing |
| Greedy step too slow at 2,000 cases | Measure first, optimise under the golden tests (section 8) |
| Step 2 changes the validated behaviour | Python first, goldens regenerated, earlier scenarios must be byte-for-byte unchanged |

## 13. New dependencies

Dev only: `vitest`, `@vitest/coverage-v8`, `fast-check`. No runtime dependency.
