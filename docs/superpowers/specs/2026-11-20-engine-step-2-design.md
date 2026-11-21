# Planning engine, step 2: generalisation

Date: 2026-11-20
Status: implemented on 2026-11-20 (plan: `docs/superpowers/plans/2026-11-20-planning-engine-step-2.md`); the six slices
and the speed measurement are done. Pull requests 1 and 2 await the owner's merge.
Part of: AC Service Scheduler, requirements v4.1 (PL-7, PL-9 to PL-11), continues
`2026-11-19-planning-engine-design.md` (section 7)

## 1. Purpose

Step 1 produced a TypeScript engine that gives the same plans as the validated Python reference, but still
carries the shape of one service center: three work types, one base that every route starts and ends at, one
working-day setting for everybody, and a single "escalated" flag. Step 2 removes those limits so that the
engine fits any AC service center, without losing the exact match with the reference.

Not in this step: certifications (FR-25.4), a weekly day off per technician, file import, screens, storage,
the map, phone features. Those belong to later pieces.

## 2. Decisions taken with the project owner (2026-11-20)

| Question | Decision |
|---|---|
| How do priority levels work? | Configurable named levels with a weight each. Higher weight is planned earlier but still balances against travel. The default two levels equal today's behaviour. |
| What does a due date do? | Soft. Urgency grows as the date nears. A visit after the due date is scheduled and flagged late. Nothing is dropped silently. |
| Where does a technician's day start and end? | A separate start place and end place per technician, both defaulting to the base. |
| How is visit time decided? | Work-type minutes, adjusted by product type, with a per-case override that wins. |
| How is the work built? | Slice by slice, Python reference first, with the existing scenarios unchanged after every slice. Rejected: one big change to both engines (a changed plan cannot be traced to a feature); an independent TypeScript rewrite (loses the Python reference as a check). |

## 3. Compatibility rule

- Every new input field is optional. Its default reproduces the step 1 behaviour. An input written for step 1
  gives the same plan.
- The result shape does not grow for old inputs. New output fields, flags and reason text appear only when
  the case or technician uses the new feature. This is what makes "the 16 existing golden files stay
  byte-for-byte unchanged" a real test.
- That rule is enforced permanently: `reference/golden/LEGACY.sha256` lists the checksum of each of the 16
  legacy files, and a Python test in CI fails if any of them changes.
- The input types keep working for the demo page (`src/demo`), which is not edited in this step.

## 4. The six slices

Order of work. Each slice is: change the Python reference, regenerate the golden files, check that the legacy
files did not change, add the slice's new scenarios, then make the same change in TypeScript.

### 4.1 Work types and skills as free lists

- Any number of work types. Each has `name`, `serviceMin`, `dailyCeiling`, `requiredSkill`.
- Skills are plain integer ids in `technician.skills`. A technician may do a case when the case's work type
  requires a skill the technician has. `requiredSkill` no longer has to equal the work type's position.
- Python: the three hard-coded lists (`CAT_NAMES`, `svc_min`, `target`) and the boolean skill array become
  lists of any length taken from the input. Reason text uses the work type name as before.
- The scoring and loops do not change.

### 4.2 Start place and end place per technician

- `technician.startPlace` and `technician.endPlace` (index into `places`). Absent means the base.
- A route runs start, stops, end. The working-day time includes the first and the last leg.
- Ordering (exact search up to 10 stops, 2-opt above) and relocation work with the technician's own start and
  end instead of the base.
- Inserting the first stop into an empty route costs the whole trip (start to stop to end), not only a detour.
  With start and end at the base this is the same number as today.
- A technician with no visits travels nothing, even when start and end differ.
- Kilometres "from the previous stop" for the first stop are measured from the start place.
- `startPlace` already exists in the TypeScript types and is ignored in step 1.

### 4.3 Working hours and breaks per technician

- `technician.dayStartMin`, `usableMin`, `lunchStartMin`, `breakMin`, each optional. A missing value uses the
  shared setting.
- The fit check, the over-capacity flag and the arrival-time calculation use the technician's own values.

### 4.4 Priority levels

- `settings.priorityLevels: { name, weight }[]`. Default: `Normal` weight 0, `Escalated` weight 100000.
- `case.priority`: index into the levels. When it is absent, `escalated: true` means the last level and
  `false` means level 0.
- Bonus of a case in the greedy step: `age bonus + level weight`, as today.
- The reason text names the level only when the case uses the new `priority` field, so old explanations
  stay identical.

### 4.5 Soft due dates

- `case.dueDay` (day number). `settings.dueWeight` (default 8, points per day) and
  `settings.urgencyWindowDays` (default 5).
- Bonus: `dueWeight x min(90, max(0, urgencyWindowDays - (dueDay - day)))`, added to the case's bonus. It is
  zero for cases without a due day.
- A case scheduled on a day after its `dueDay` gets the flag `LATE BY n DAYS` (`n` in calendar days). When the
  `OVER CAPACITY` flag also applies, the two are joined with `; `.
- A case that never fits keeps its "beyond planning horizon" reason and gets `; due date missed` added when it
  has a due day.

### 4.6 Visit time

- `productTypes?: { name, addMin?, factor? }[]` at the top of the input. `case.productType` (index) and
  `case.serviceMin` (override) are optional.
- Minutes of a case: the override when given, otherwise `workType.serviceMin x (factor ?? 1) + (addMin ?? 0)`.
- Used in the fit check, the route's service total and the arrival-time calculation. The daily ceiling still
  counts visits per work type.

### 4.7 Input checks

`check.ts` rejects invalid new fields with a plain message that names the field and the case or technician,
for example "case 12 has priority 5 but only 2 levels exist". Covered: indexes out of range, negative or
non-finite minutes and weights, a non-integer due day, an end place out of range.

## 5. Testing

- **Scenarios.** Two or three new synthetic scenarios per slice, all generated from a fixed seed over the
  fictional city. Examples: five work types whose skills do not match their position; home-to-home and
  home-to-depot technicians; a technician with short hours; four priority levels; due dates met, late and
  never met; product factors with a per-case override. Python exports them to `reference/golden/`, the
  TypeScript golden test compares them with the same rules as step 1 (discrete outputs exact, reals within
  1e-9).
- **Legacy files.** The checksum manifest in section 3. A slice is not accepted while any legacy file differs.
- **Invariants.** The checker in `src/engine/testing/invariants.ts` uses each technician's own hours and the
  first and last legs for the capacity rule. New rules: a visit has the late flag exactly when its day is after
  its due day; visit minutes add up to the route's service total. The random input generator produces the new
  optional fields.
- **Real data (DS-1).** After every slice, run locally: the baseline plan and the one-technician-inactive plan
  must still be identical to the reference. It never leaves the owner's PC.
- Engine coverage stays at 90% or higher.

## 6. Speed

After the six slices, measure planning time on a synthetic 2,000-case, 100-technician scenario (the project's
target size, NFR-4) and report the numbers. This step only measures. If the time is too long, the optimisation
is proposed as its own piece, because it must give identical plans and may change the Python reference.

**Measured on 2026-11-20** (`VITE_MEASURE_SPEED=1 npx vitest run src/engine/speed.measure.test.ts`, owner's
laptop, Node, one thread, every step 2 feature in use):

| Cases | Technicians | Horizon | Result | Time |
|---|---|---|---|---|
| 500 | 30 | 3 days | 202 scheduled, 298 unscheduled | 0.07 s |
| 1,000 | 60 | 12 days | 987 scheduled | 0.43 s |
| 2,000 | 100 | 15 days | 2,000 scheduled in 11 days | 4.0 s |
| 2,000 | 100 | 30 days | 2,000 scheduled in 11 days | 6.1 s |
| 2,000 | 25 | 30 days | 1,728 scheduled, 272 unscheduled, all 30 days used | 1.6 s |

NFR-4 asks for 2,000 cases, 100 technicians and a 30-day horizon within 30 seconds on a typical office laptop.
The measured 4 to 6 seconds leave a margin of about five. No optimisation is needed now. A phone is slower than a
laptop; the reference phone (PD-9) has not been chosen, so a phone measurement is still open.

**Corrected on 2026-11-22 (hardening).** The generator above gives each technician one skill. A centre where each
technician can do two of the three work types (the usual case) has about twice as many technicians eligible for each
case, and the same size then took **42 s** in Node (27 s in the browser's worker), over the 30 s of NFR-4. The cost
was in `greedy` (70% of the time): after every stop it looked at every case against every technician again, though
only the one route that got the stop had changed. It now keeps each case's best offer and looks again only where the
changed route matters, and keeps what adding a case to a route costs until that route changes. The choice is the
same as a full scan would make, so no plan changed: all 28 golden files from the Python reference (the reference
itself is not touched) and 17 plan fingerprints of made-up centres (`src/engine/fingerprint.test.ts`, taken before
the change) are identical. The speed table is in section 13 of the phone and sharing design.

## 7. Delivery

Branch `engine-step-2`, commits per slice. Two pull requests:

1. Slices 4.1 to 4.3 (free work types and skills, start and end places, per-technician hours).
2. Slices 4.4 to 4.6, the input checks, the speed numbers and the updated documents.

Each is pushed only on the owner's go-ahead and merged only after all checks are green. The live demo keeps
working throughout because old inputs still work.

## 8. Files touched

| Area | Change |
|---|---|
| `reference/python/engine.py` | The six slices. Header comment lists each change. |
| `reference/convert.py`, `scenarios.py`, `export_golden.py`, `test_reference.py` | New fields in the converters, new scenarios, new checks, the legacy manifest test |
| `reference/golden/` | New scenario files. `LEGACY.sha256` added. Legacy files unchanged. |
| `src/engine/types.ts`, `check.ts`, `context.ts` | New optional fields, validation, derived values (per-technician hours, per-case minutes, bonus table) |
| `src/engine/geo.ts`, `route.ts`, `order.ts`, `plan.ts`, `finalise.ts` | Start and end places, per-technician limits, priority and due bonuses, flags and reason text |
| `src/engine/testing/` | Generator, invariants |
| `docs/superpowers/specs/2026-11-19-planning-engine-design.md` | Interface section updated at the end of step 2 |

## 9. Risks

| Risk | Mitigation |
|---|---|
| A slice changes a legacy plan by accident | The checksum manifest test fails in CI. Each slice is checked before the next starts. |
| Start and end places break the exact ordering (fixed endpoints) | A brute-force comparison test on small routes with start different from end, as in step 1 for the base |
| Due-date defaults (weight 8, window 5) turn out wrong for a real center | They are settings, not constants. The values are a starting point and are tuned later with real data. |
| Planning too slow at 2,000 cases | Measured at the end (section 6) and handled as its own piece |
| New fields leak into the demo or the types it uses | The demo is type-checked in CI. Old inputs must keep compiling. |

## 10. Finish line

- All legacy and new golden tests pass in the public pipeline.
- On the owner's PC, DS-1 gives an identical plan for the baseline and for one technician inactive.
- Invariant tests pass. Engine coverage is at least 90%.
- Each slice has golden and unit tests. The pipeline is green on GitHub for both pull requests.
- The speed numbers are reported.

Estimate: 8 to 12 hours of build time, about three working sessions.
