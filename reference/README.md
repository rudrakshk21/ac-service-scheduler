# Reference engine and golden files

`python/engine.py` is the validated Python planning engine. Two kinds of change were made to it, both
reported to and approved by the project owner:

1. **Rounding.** Travel times are rounded to 9 decimals (`snap`). The maths library differs in the last digit
   between operating systems, and exact ties between equally short stop orders were decided by that noise, so
   the same input gave different plans on Windows and Linux. With `snap` every machine sees the same numbers.
   The web engine does the same four exact steps in `snapMinutes` (`src/engine/geo.ts`). Effect on the owner's
   real data (DS-1): every case keeps its technician and day, total travel is identical, and 11 of 140 routes
   visit the same stops in a different, equally short order.
2. **Step 2 generalisation** (design: `docs/superpowers/specs/2026-11-20-engine-step-2-design.md`): work types
   and skills as free lists, a start and an end place per technician, working hours per technician, priority
   levels, soft due dates, visit time by product type. Every new input field is optional. For an input that
   uses none of them the plan is identical, which the legacy checksums below prove.

## Files

- `scenarios.py`: the 16 original scenarios. `scenarios_step2.py`: the scenarios added in step 2, one or two per
  feature. Everything in both is invented: a made-up region and made-up names.
- `py reference/export_golden.py` runs all scenarios through the Python engine, checks that each one exercises
  what it is for, and writes `golden/*.json`: the input and the complete result of each. The files are committed.
- `golden/LEGACY.sha256` holds the checksum of each of the 16 original golden files. **They must never change.**
  A test fails when one does: step 2 may only add scenarios, never alter an old plan.
- `py reference/test_reference.py` checks the scenarios, that the committed golden files are current, the legacy
  checksums, and that `snap` rounds exactly like the web engine.
- `src/engine/golden.test.ts` runs the web engine on the same inputs and compares.
- `py reference/export_ds1_local.py` exports real data into `reference-local/`, which Git ignores. Run it only
  on the owner's PC. Never commit that folder.
- `py reference/check_ds1_local.py` (local only) runs the Python engine on the stored real inputs and compares
  with the stored real plans. It does nothing when `reference-local/` is absent.

Real numbers are compared with a tolerance of one part in a billion. Everything else (technician, day, visit,
arrival time, text, stop order) must match exactly.

## Adding a scenario

Add a builder to `scenarios_step2.py` and to its `STEP2` dictionary, add a self-check to `export_golden.py`
(`CHECKS`) that proves the scenario really exercises its feature, run `py reference/export_golden.py`, and
confirm `git status reference/golden` shows only new files, then run the tests on both sides.
