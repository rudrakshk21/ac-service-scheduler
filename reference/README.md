# Reference engine and golden files

`python/engine.py` is the validated Python planning engine with **one change**: travel times are rounded to
9 decimals (`snap`). The maths library differs in the last digit between operating systems, and exact ties
between equally short stop orders were decided by that noise, so the same input gave different plans on
Windows and Linux. With `snap` every machine sees the same numbers. The web engine does the same four exact
steps in `snapMinutes` (`src/engine/geo.ts`).

Effect on the owner's real data (DS-1): every case keeps its technician and day, total travel is identical,
and 11 of 140 routes visit the same stops in a different, equally short order.

- `py reference/export_golden.py` runs 16 synthetic scenarios (`scenarios.py`) through the Python engine
  and writes `golden/*.json`: the input and the complete result of each. The files are committed.
- `py reference/test_reference.py` checks that each scenario exercises what it is for, that the committed
  golden files are current, and that `snap` rounds exactly like the web engine.
- `src/engine/golden.test.ts` runs the web engine on the same inputs and compares.
- `py reference/export_ds1_local.py` exports real data into `reference-local/`, which Git ignores. Run it only
  on the owner's PC. Never commit that folder.

Real numbers are compared with a tolerance of one part in a billion. Everything else (technician, day, visit,
arrival time, text, stop order) must match exactly.

Everything in `scenarios.py` is invented: a made-up region and made-up names.
