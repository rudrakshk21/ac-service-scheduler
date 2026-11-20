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
