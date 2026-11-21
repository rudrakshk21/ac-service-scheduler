# Planning Engine Step 2 (Generalisation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, no subagents: the project owner manages usage limits). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalise the planning engine in six checked slices (free work types and skills, start and end place per technician, per-technician hours, priority levels, soft due dates, visit time by product) without changing any existing plan.

**Architecture:** Every slice changes the Python reference first (`reference/python/engine.py`), regenerates the golden files, proves the 16 legacy golden files are byte-for-byte unchanged, adds the slice's new synthetic scenarios, then makes the same change in the TypeScript engine, whose golden test must give an identical plan. New input fields are optional and default to today's behaviour; new output text appears only when a feature is used.

**Tech Stack:** TypeScript 7 (strict, `erasableSyntaxOnly`, `verbatimModuleSyntax`), Vitest 5 + fast-check, Python 3 standard library (`py` on this PC), oxlint.

**Spec:** `docs/superpowers/specs/2026-11-20-engine-step-2-design.md` (approved by the owner on 2026-11-20). Read it first; this plan implements sections 4 to 7.

## Global Constraints

- Repo `<repo>`. Branch `engine-step-2` (never `main`). Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- The 16 legacy golden files in `reference/golden/` must stay byte-for-byte unchanged. `reference/golden/LEGACY.sha256` enforces it. If a legacy file would change, stop: the slice is wrong.
- Every new input field is optional with a default that reproduces step 1. Output shape does not grow for old inputs.
- The engine never sorts; input order is tie-break order. Loop order, strict `<` comparisons and arithmetic order must match between Python and TypeScript. Travel times stay rounded with `snap` / `snapMinutes`.
- Real data (DS-1) never enters a committed file. Only `reference-local/` (git-ignored) holds it.
- Engine coverage at least 90% statements and lines (Vitest thresholds). Lint, `tsc -b`, tests, Python tests and `npm run build` must pass.
- From PowerShell pass paths to npm/npx with forward slashes. In Bash use `py` for Python.
- Dates are whole day numbers since 1970-01-01. Minutes and kilometres as in the existing types.
- Full local check command (run after every task; all must pass):
  `cd <repo> && npm run lint && npx tsc -b && npm run test:coverage && py -m unittest discover -s reference -p "test_*.py" && py reference/check_ds1_local.py`

## File Structure

| File | Responsibility |
|---|---|
| `reference/python/engine.py` | The reference engine; gains all six features |
| `reference/convert.py` | JSON shape to/from the Python objects |
| `reference/scenarios_step2.py` (new) | The new synthetic scenarios, kept apart from the 16 legacy ones in `scenarios.py` |
| `reference/export_golden.py` | Runs all scenarios, self-checks, writes goldens |
| `reference/check_ds1_local.py` (new) | Local only: the Python reference on the stored real inputs must equal the stored real plans |
| `reference/test_reference.py` | Python tests, including the legacy checksum test |
| `reference/golden/LEGACY.sha256` (new) | Checksums of the 16 legacy files |
| `src/engine/types.ts`, `check.ts`, `context.ts` | New optional fields, validation, values computed once per plan |
| `src/engine/route.ts`, `order.ts`, `plan.ts`, `finalise.ts` | Start/end places, per-technician limits, bonuses, flags, reason text |
| `src/engine/testing/generate.ts`, `invariants.ts` | Extended random input and safety rules |
| `src/engine/check.test.ts` (new), `route.test.ts`, `order.test.ts`, `plan.test.ts`, `golden.test.ts`, `invariants.test.ts` | Tests |
| `src/engine/speed.measure.test.ts` (new) | Opt-in speed measurement (skipped unless `VITE_MEASURE_SPEED=1`) |

---

### Task 1: Guard rails (legacy checksums, scenario count, local real-data check)

**Files:**
- Create: `reference/golden/LEGACY.sha256`, `reference/check_ds1_local.py`
- Modify: `reference/test_reference.py`, `src/engine/golden.test.ts`

**Interfaces:**
- Produces: `LEGACY.sha256` lines `<sha256 hex>  <name>.json`; `py reference/check_ds1_local.py` exit 0 when every file in `reference-local/` is reproduced by the Python reference, 0 with a message when the folder is absent.

- [ ] **Step 1: Create the manifest from the current files (one time, never regenerated)**

Run (Bash): `cd <repo>/reference/golden && for f in *.json; do printf '%s  %s\n' "$(sha256sum "$f" | cut -d' ' -f1)" "$f"; done > LEGACY.sha256 && wc -l LEGACY.sha256`
Expected: `16 LEGACY.sha256`.

- [ ] **Step 2: Add the test to `reference/test_reference.py`**

Add `import hashlib` and `import scenarios` to the imports, replace `test_there_are_sixteen_distinct_scenarios`, and add a class:

```python
    def test_scenario_names_are_distinct_and_include_the_sixteen_originals(self):
        names = [name for name, _ in export_golden.build_all()]
        self.assertEqual(len(names), len(set(names)))
        self.assertEqual(len(scenarios.SCENARIOS), 16)
        self.assertTrue(set(scenarios.SCENARIOS) <= set(names))


class LegacyGoldens(unittest.TestCase):
    """The 16 original golden files must never change: step 2 may only add scenarios."""

    def test_the_sixteen_original_files_are_byte_for_byte_unchanged(self):
        text = (export_golden.GOLDEN_DIR / "LEGACY.sha256").read_text(encoding="utf-8")
        entries = [line.split("  ") for line in text.split("\n") if line.strip()]
        self.assertEqual(sorted(name[:-5] for _, name in entries), sorted(scenarios.SCENARIOS))
        for digest, name in entries:
            data = (export_golden.GOLDEN_DIR / name).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(), digest, name + " changed: a slice altered an old plan")
```

- [ ] **Step 3: Create `reference/check_ds1_local.py`**

```python
"""Local only. Runs the Python reference on the stored real DS-1 inputs (git-ignored reference-local/) and
compares with the stored plans. Exit code 1 when any differs. Does nothing when the folder is absent."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from convert import same  # noqa: E402
from export_golden import run_scenario  # noqa: E402


def main():
    folder = HERE.parent / "reference-local"
    files = sorted(folder.glob("*.json")) if folder.exists() else []
    if not files:
        print("reference-local/ not found: no real-data check on this machine")
        return 0
    bad = 0
    for f in files:
        payload = json.loads(f.read_text(encoding="utf-8"))
        result, _ = run_scenario(payload["input"])
        diffs = same(payload["expected"], result, f.stem)
        print("%-36s %s" % (f.name, "identical" if not diffs else "DIFFERENT: " + "; ".join(diffs[:3])))
        bad += bool(diffs)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Relax the count in `src/engine/golden.test.ts`**

Replace the `finds all 16 scenarios` test with:

```ts
  it('finds at least the 16 original scenarios', () => {
    expect(goldens.length).toBeGreaterThanOrEqual(16)
  })
```

- [ ] **Step 5: Run the full local check; commit**

Run the Global Constraints check command. Expected: all pass; `check_ds1_local.py` prints `identical` for both files (if it prints a payload-key error, open one file in `reference-local/`, print its keys, and adapt the two key names `input` / `expected` here and in the DS-1 TypeScript test).

```bash
git add reference src/engine/golden.test.ts
git commit -m "test: guard the 16 legacy golden files with checksums and add a local real-data check" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Slice 1, work types and skills as free lists

**Files:**
- Modify: `reference/python/engine.py`, `reference/convert.py`, `reference/export_golden.py`
- Create: `reference/scenarios_step2.py`
- Modify (only if a test fails): `src/engine/*` (the TypeScript engine is already general: `requiredSkill` is free and `skills` are ids)

**Interfaces:**
- Produces (Python): `Cfg.cat_names: list[str]`, `Cfg.req_skill: list[int]` (skill id each work type requires); `TechIn.skill` is a list of booleans indexed by skill id, any length; `Engine.can_do(t, c)`.
- Produces (scenarios): `scenarios_step2.STEP2 = {name: builder}`, builders return a PlanInput dict.

- [ ] **Step 1: Python engine. In `engine.py` add to `Cfg`** (after `holidays`):

```python
    cat_names: list = field(default_factory=lambda: list(CAT_NAMES))
    req_skill: list = field(default_factory=lambda: [0, 1, 2])
```

Replace `can_do`:

```python
    def can_do(self, t, c):
        need = self.C.req_skill[self.cases[c].cat]
        have = self.techs[t].skill
        return need < len(have) and have[need]
```

In `finalise`, replace `CAT_NAMES[self.cases[c].cat]` with `C.cat_names[self.cases[c].cat]`. Update the module docstring: add a line after the ONE CHANGE paragraph: `STEP 2 (generalisation): the changes below are listed in docs/superpowers/specs/2026-11-20-engine-step-2-design.md; for inputs that use no new feature the plan is identical.`

- [ ] **Step 2: `reference/convert.py` `to_python`.** Delete the assertion on `requiredSkill == [0, 1, 2]`, add after the `restWeekdays` assertion:

```python
    n_skills = 1 + max([w["requiredSkill"] for w in inp["workTypes"]] + [k for t in inp["technicians"] for k in t["skills"]])
```

Add to `engine.Cfg(...)`: `cat_names=[w["name"] for w in inp["workTypes"]], req_skill=[w["requiredSkill"] for w in inp["workTypes"]],` and change the technician skill line to `skill=[i in t["skills"] for i in range(n_skills)],`. Leave the `startPlace` assertion for now (Task 3 removes it).

- [ ] **Step 3: Create `reference/scenarios_step2.py`**

```python
"""Synthetic scenarios for the step 2 features. Everything is invented. Only Rng.random() is used."""
import copy

from scenarios import START, Rng, base, make_places, settings

WORK_TYPES_5 = [
    {"name": "Installation", "serviceMin": 120.0, "dailyCeiling": 3.0, "requiredSkill": 0},
    {"name": "Service", "serviceMin": 75.0, "dailyCeiling": 5.0, "requiredSkill": 1},
    {"name": "Breakdown", "serviceMin": 75.0, "dailyCeiling": 5.0, "requiredSkill": 2},
    {"name": "Gas refill", "serviceMin": 60.0, "dailyCeiling": 6.0, "requiredSkill": 2},
    {"name": "Inspection", "serviceMin": 30.0, "dailyCeiling": 10.0, "requiredSkill": 3},
]


def five_work_types():
    rng = Rng(21)
    places = make_places(rng, 12)
    techs = [{"name": "Technician %02d" % (i + 1), "skills": [i % 4], "active": True} for i in range(10)]
    techs[4]["skills"] = [0, 3]
    cases = [{"id": str(200001 + i), "workType": rng.pick([20, 25, 25, 15, 15]), "place": rng.int(0, 11),
              "escalated": False, "reportedDay": START - rng.int(0, 30)} for i in range(80)]
    return {"settings": settings(), "workTypes": copy.deepcopy(WORK_TYPES_5), "technicians": techs,
            "places": places, "cases": cases}


def skills_not_position():
    inp = base(22, 60, 9, 12)
    inp["workTypes"][0]["requiredSkill"] = 2
    inp["workTypes"][1]["requiredSkill"] = 0
    inp["workTypes"][2]["requiredSkill"] = 1
    inp["technicians"][0]["skills"] = [0, 1]
    return inp


STEP2 = {f.__name__: f for f in (five_work_types, skills_not_position)}
```

- [ ] **Step 4: `reference/export_golden.py`.** Import `from scenarios_step2 import STEP2`; in `build_all` iterate `list(SCENARIOS.items()) + list(STEP2.items())`. Add checks and register them in `CHECKS`:

```python
def check_five(inp, out, calls):
    kinds = {c["workType"] for c in inp["cases"] if c["id"] in {s["id"] for s in _scheduled(out)}}
    assert kinds == {0, 1, 2, 3, 4}, "not every work type was scheduled: %s" % sorted(kinds)


def check_skills_not_position(inp, out, calls):
    need = {i: w["requiredSkill"] for i, w in enumerate(inp["workTypes"])}
    cases = {c["id"]: c for c in inp["cases"]}
    for s in _scheduled(out):
        assert need[cases[s["id"]]["workType"]] in inp["technicians"][s["tech"]]["skills"], "wrong skill for " + s["id"]
    assert len(_scheduled(out)) > 40, "too few cases scheduled"
```

`CHECKS` gains `"five_work_types": check_five, "skills_not_position": check_skills_not_position`.

- [ ] **Step 5: Regenerate and verify the legacy files are untouched**

Run: `py reference/export_golden.py && git status --short reference/golden && py -m unittest discover -s reference -p "test_*.py"`
Expected: the only changes under `reference/golden/` are two new untracked files (`five_work_types.json`, `skills_not_position.json`); no `M` line; Python tests OK (including the legacy checksum test).

- [ ] **Step 6: TypeScript golden test.** Run `npx vitest run src/engine/golden.test.ts`. Expected: 18 golden files, all identical. If either new scenario differs, the TypeScript engine has a hidden three-work-type assumption: find it (`grep -n "workTypes\[" src/engine/*.ts`) and fix it here.

- [ ] **Step 7: Full local check; commit**

```bash
git add reference src
git commit -m "feat(engine): work types and skills as free lists (Python reference first)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Slice 2, start place and end place per technician

**Files:**
- Modify: `reference/python/engine.py`, `reference/convert.py`, `reference/scenarios_step2.py`, `reference/export_golden.py`
- Modify: `src/engine/types.ts`, `check.ts`, `context.ts`, `route.ts`, `order.ts`, `plan.ts`, `finalise.ts`
- Test: `src/engine/route.test.ts`, `src/engine/order.test.ts`, `src/engine/check.test.ts` (create)

**Interfaces:**
- Python: `TechIn.start_area`, `TechIn.end_area` (area index, -1 = base); `Route(s=0, e=0)` with `s`/`e` nodes; `travel_of(stops, s=0, e=0)`; `Engine.new_route(t)`.
- TypeScript: `Technician.endPlace?: number`; `Ctx.techPlan: TechPlan[]` (`{ startNode, endNode, usableMin, dayStartMin, lunchStartMin, breakMin }`, the last four filled in Task 4); `new Route(startNode = 0, endNode = 0, usableMin?: number)`; `travelOf(ctx, stops, startNode = 0, endNode = 0)`.

- [ ] **Step 1: Python `Route` and `TechIn`.** Route:

```python
class Route:
    __slots__ = ("stops", "travel", "service", "frac", "pinned", "ver", "s", "e")

    def __init__(self, s=0, e=0):
        self.stops: list[int] = []
        self.travel = 0.0
        self.service = 0.0
        self.frac = 0.0
        self.pinned = False
        self.ver = 0
        self.s = s
        self.e = e
```

`TechIn` gains `start_area: int = -1` and `end_area: int = -1`. `Engine` gains:

```python
    def new_route(self, t):
        T = self.techs[t]
        return Route(0 if T.start_area < 0 else T.start_area + 1, 0 if T.end_area < 0 else T.end_area + 1)
```

- [ ] **Step 2: Python travel, insertion, order, relocate, plan, finalise.**

`travel_of`:

```python
    def travel_of(self, stops, s=0, e=0):
        if not stops:
            return 0.0
        t, prev = 0.0, s
        for c in stops:
            nd = self.node(c)
            t += self.tm[prev][nd]
            prev = nd
        return t + self.tm[prev][e]
```

`best_insert` (an empty route costs the whole trip, not a detour):

```python
    def best_insert(self, r: Route, c):
        n, cn, tm = len(r.stops), self.node(c), self.tm
        if n == 0:
            return tm[r.s][cn] + tm[cn][r.e], 0
        delta, pos = float("inf"), 0
        for p in range(n + 1):
            prev = r.s if p == 0 else self.node(r.stops[p - 1])
            nxt = r.e if p == n else self.node(r.stops[p])
            d = tm[prev][cn] + tm[cn][nxt] - tm[prev][nxt]
            if d < delta:
                delta, pos = d, p
        return delta, pos
```

`recalc`: `r.travel = self.travel_of(r.stops, r.s, r.e)`.
`order`: `dp[1 << j][j] = tm[r.s][nodes[j]]`; `v = dp[full - 1][j] + tm[nodes[j]][r.e]`; in 2-opt `cur = self.travel_of(r.stops, r.s, r.e)` and `v = self.travel_of(t, r.s, r.e)`.
`relocate`: `saved = r.travel - self.travel_of(without, r.s, r.e)`.
`plan`: `routes = {t: self.new_route(t) for t in range(len(self.techs)) if self.available(t, day)}`.
`finalise`: `clock, brk, prev = C.start_min, False, r.s`; `nxt = ... else r.e`; `pn = r.s if i == 0 else self.node(r.stops[i - 1])`; and the kilometres loop starts with `prev_area = r.s - 1`.

- [ ] **Step 3: `convert.py`.** Delete the `startPlace` assertion. In the `TechIn(...)` call add `start_area=t.get("startPlace", -1), end_area=t.get("endPlace", -1),`.

- [ ] **Step 4: Scenarios.** Append to `scenarios_step2.py` (before `STEP2`) and register in `STEP2`:

```python
def home_and_depot():
    inp = base(23, 60, 9, 12)
    for i in (0, 1, 2, 3):
        inp["technicians"][i]["startPlace"] = i
    for i in (2, 3, 4):
        inp["technicians"][i]["endPlace"] = (i + 5) % 12
    return inp


def home_to_home():
    inp = base(24, 50, 6, 8)
    for i, t in enumerate(inp["technicians"]):
        t["startPlace"] = i
        t["endPlace"] = i
    return inp


def long_routes_with_ends():
    inp = base(25, 45, 3, 3)
    for w in inp["workTypes"]:
        w["serviceMin"] = 10.0
        w["dailyCeiling"] = 40.0
    for t in inp["technicians"]:
        t["startPlace"] = 0
        t["endPlace"] = 1
    return inp
```

Checks in `export_golden.py` (register as `home_and_depot`, `home_to_home`, `long_routes_with_ends`):

```python
def check_ends(inp, out, calls):
    moved = {i for i, t in enumerate(inp["technicians"]) if t.get("startPlace", -1) != t.get("endPlace", -1)}
    assert any(s["tech"] in moved for s in _scheduled(out)), "no technician with different start and end was used"


def check_home_to_home(inp, out, calls):
    assert len(_scheduled(out)) > 30, "too few cases scheduled"
    firsts = [s for s in _scheduled(out) if s["visit"] == 1]
    assert any(s["prevKm"] == 0.0 for s in firsts), "no first stop sits at the technician's own start place"


def check_long_ends(inp, out, calls):
    assert max(len(r["stops"]) for r in out["routes"]) > 10, "no route has more than 10 stops"
```

- [ ] **Step 5: Regenerate, check legacy untouched**

Run: `py reference/export_golden.py && git status --short reference/golden && py -m unittest discover -s reference -p "test_*.py" && py reference/check_ds1_local.py`
Expected: only new untracked golden files; tests OK; DS-1 lines say `identical`.

- [ ] **Step 6: Write the failing TypeScript tests.** In `src/engine/route.test.ts` add to the imports nothing new, and append:

```ts
describe('start and end places', () => {
  it('travelOf runs from the start place to the end place', () => {
    const ctx = ctxFor([0, 0, 0])
    const tm = ctx.geo.tm
    expect(travelOf(ctx, [0, 1], 3, 2)).toBe(tm[3][1] + tm[1][2] + tm[2][2])
    expect(travelOf(ctx, [], 3, 2)).toBe(0)
  })
  it('an empty route costs the whole trip start, stop, end', () => {
    const ctx = ctxFor([0, 0])
    const r = new Route(1, 2)
    const { delta, pos } = bestInsert(ctx, r, 0)
    expect(pos).toBe(0)
    expect(delta).toBe(ctx.geo.tm[1][1] + ctx.geo.tm[1][2])
  })
  it('inserts between stops using the start and end places for the ends', () => {
    const ctx = ctxFor([0, 0, 0])
    const r = new Route(3, 3)
    r.stops = [0]
    recalc(ctx, r)
    const tm = ctx.geo.tm
    const { delta, pos } = bestInsert(ctx, r, 1)
    const front = tm[3][2] + tm[2][1] - tm[3][1]
    const back = tm[1][2] + tm[2][3] - tm[1][3]
    expect(delta).toBe(Math.min(front, back))
    expect(pos).toBe(front < back ? 0 : 1)
  })
})
```

In `src/engine/order.test.ts` add (and import `Route` is already there):

```ts
  it('finds the shortest order when the start and end places differ (exact search)', () => {
    for (const seed of [21, 22, 23]) {
      const ctx = buildContext(generateInput(seed, 7, 3, 6))
      const stops = ctx.cases.map((_, i) => i)
      const r = new Route(2, 5)
      r.stops = [...stops].reverse()
      recalc(ctx, r)
      orderRoute(ctx, r)
      const best = Math.min(...permutations(stops).map((p) => travelOf(ctx, p, 2, 5)))
      expect(r.travel).toBeCloseTo(best, 9)
    }
  })
```

Create `src/engine/check.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { plan } from './index'
import { START, testInput } from './testing/fixtures'

const place = { name: 'P', lat: 20, lon: 30 }
const tech = { name: 'T', skills: [0], active: true }
const aCase = { id: '1', workType: 0, place: 0, reportedDay: START }

describe('input checks for step 2 fields', () => {
  it('rejects an end place that does not exist', () => {
    const input = testInput({ places: [place], technicians: [{ ...tech, endPlace: 3 }], cases: [aCase] })
    expect(() => plan(input)).toThrow('technicians[0].endPlace')
  })
})
```

Run `npx vitest run src/engine/route.test.ts src/engine/order.test.ts src/engine/check.test.ts`. Expected: FAIL (TypeScript errors / wrong values).

- [ ] **Step 7: TypeScript implementation.**

`types.ts`: in `Technician` replace the `startPlace` comment and add `endPlace`:

```ts
  /** Place the day starts at (index into `places`). Absent: the base. */
  startPlace?: number
  /** Place the day ends at. Absent: the base. */
  endPlace?: number
```

`context.ts`: add and fill

```ts
export interface TechPlan {
  startNode: number
  endNode: number
}
```

to `Ctx` as `techPlan: TechPlan[]`, built with `input.technicians.map((t) => ({ startNode: t.startPlace === undefined ? 0 : t.startPlace + 1, endNode: t.endPlace === undefined ? 0 : t.endPlace + 1 }))` (Task 4 extends `TechPlan`).

`route.ts`: class and functions:

```ts
export class Route {
  stops: number[] = []
  travel = 0.0
  service = 0.0
  frac = 0.0
  pinned = false
  ver = 0
  readonly startNode: number
  readonly endNode: number
  constructor(startNode = 0, endNode = 0) {
    this.startNode = startNode
    this.endNode = endNode
  }
}

export function travelOf(ctx: Ctx, stops: number[], startNode = 0, endNode = 0): number {
  if (stops.length === 0) return 0.0
  const tm = ctx.geo.tm
  let t = 0.0
  let prev = startNode
  for (const c of stops) {
    const nd = ctx.caseNode[c]
    t += tm[prev][nd]
    prev = nd
  }
  return t + tm[prev][endNode]
}

export function bestInsert(ctx: Ctx, r: Route, c: number): { delta: number; pos: number } {
  const n = r.stops.length
  const cn = ctx.caseNode[c]
  const tm = ctx.geo.tm
  // An empty route costs the whole trip (start, stop, end), not a detour.
  if (n === 0) return { delta: tm[r.startNode][cn] + tm[cn][r.endNode], pos: 0 }
  let delta = Infinity
  let pos = 0
  for (let p = 0; p <= n; p++) {
    const prev = p === 0 ? r.startNode : ctx.caseNode[r.stops[p - 1]]
    const nxt = p === n ? r.endNode : ctx.caseNode[r.stops[p]]
    const d = tm[prev][cn] + tm[cn][nxt] - tm[prev][nxt]
    if (d < delta) {
      delta = d
      pos = p
    }
  }
  return { delta, pos }
}
```

`recalc`: `r.travel = travelOf(ctx, r.stops, r.startNode, r.endNode)`.

`order.ts`: `dp[(1 << j) * n + j] = tm[r.startNode][nodes[j]]`; `dp[(full - 1) * n + j] + tm[nodes[j]][r.endNode]`; 2-opt `travelOf(ctx, r.stops, r.startNode, r.endNode)` and `travelOf(ctx, t, r.startNode, r.endNode)`.

`plan.ts`: in `relocate`, `travelOf(ctx, without, r.startNode, r.endNode)`; in `runPlan`, `routes.set(t, new Route(ctx.techPlan[t].startNode, ctx.techPlan[t].endNode))`.

`finalise.ts`: `let prev = r.startNode`; `const nxt = i + 1 < r.stops.length ? ctx.caseNode[r.stops[i + 1]] : r.endNode`; `const pn = i === 0 ? r.startNode : ctx.caseNode[r.stops[i - 1]]`; in the kilometres loop `let prevPlace = r.startNode - 1`.

`check.ts`: after the `startPlace` line add `if (t.endPlace !== undefined) needInt(\`technicians[${i}].endPlace\`, t.endPlace, 0, input.places.length - 1)`.

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/engine`. Expected: PASS, including the three new golden scenarios (identical plans) and every legacy one.

- [ ] **Step 9: Full local check; commit**

```bash
git add reference src
git commit -m "feat(engine): start place and end place per technician" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Slice 3, working hours and breaks per technician

**Files:**
- Modify: `reference/python/engine.py`, `reference/convert.py`, `reference/scenarios_step2.py`, `reference/export_golden.py`
- Modify: `src/engine/types.ts`, `check.ts`, `context.ts`, `route.ts`, `plan.ts`, `finalise.ts`
- Test: `src/engine/route.test.ts`, `src/engine/check.test.ts`

**Interfaces:**
- Python: `TechIn.usable_min/start_min/lunch_min/break_min` (`None` = shared setting); `Route.usable` (None = shared).
- TypeScript: `Technician.usableMin?/dayStartMin?/lunchStartMin?/breakMin?`; `TechPlan` gains `usableMin, dayStartMin, lunchStartMin, breakMin` (all resolved); `new Route(startNode, endNode, usableMin?)` with `readonly usableMin?: number`.

- [ ] **Step 1: Python.** `TechIn` gains `usable_min: float | None = None`, `start_min: float | None = None`, `lunch_min: float | None = None`, `break_min: float | None = None`. `Route.__slots__` adds `"usable"`; `__init__(self, s=0, e=0, usable=None)` sets `self.usable = usable`. `new_route`:

```python
    def new_route(self, t):
        T = self.techs[t]
        return Route(0 if T.start_area < 0 else T.start_area + 1, 0 if T.end_area < 0 else T.end_area + 1,
                     T.usable_min)
```

`fits`: replace the first condition with

```python
        usable = self.C.usable_min if r.usable is None else r.usable
        if r.travel + delta + r.service + self.C.svc_min[cat] > usable + 1e-6:
            return False
```

`finalise`, inside `for t, r in ...:` at the top (after `self.recalc(r)`):

```python
                T = self.techs[t]
                start_min = C.start_min if T.start_min is None else T.start_min
                lunch_min = C.lunch_min if T.lunch_min is None else T.lunch_min
                break_min = C.break_min if T.break_min is None else T.break_min
                usable = C.usable_min if r.usable is None else r.usable
```

and use them: `clock, brk, prev = start_min, False, r.s`; `if r.travel + r.service > usable + 1e-6:`; `if not brk and clock >= lunch_min:`; `clock += break_min`.

- [ ] **Step 2: `convert.py`.** In `TechIn(...)` add `usable_min=t.get("usableMin"), start_min=t.get("dayStartMin"), lunch_min=t.get("lunchStartMin"), break_min=t.get("breakMin"),`.

- [ ] **Step 3: Scenarios** (append, register in `STEP2`):

```python
def tech_hours():
    inp = base(26, 60, 9, 12)
    t = inp["technicians"]
    t[0]["usableMin"] = 240.0
    t[1].update({"dayStartMin": 480.0, "lunchStartMin": 720.0, "breakMin": 30.0})
    t[2].update({"usableMin": 600.0, "breakMin": 0.0})
    t[3]["dayStartMin"] = 600.0
    return inp


def short_day_overload():
    inp = base(27, 30, 6, 8)
    inp["technicians"][0]["usableMin"] = 120.0
    for i in range(4):
        inp["cases"][i]["workType"] = 0
        inp["cases"][i]["pinnedTech"] = 0
        inp["cases"][i]["earliestDay"] = START
    return inp
```

Checks (register as `tech_hours`, `short_day_overload`):

```python
def check_tech_hours(inp, out, calls):
    short = [r for r in out["routes"] if r["tech"] == 0 and r["stops"]]
    assert short, "the short-hours technician has no route"
    assert all(r["travelMin"] + r["serviceMin"] <= 240.0 + 1e-6 for r in short), "short-hours technician over 240 minutes"
    firsts = [s["eta"] for s in _scheduled(out) if s["tech"] == 1 and s["visit"] == 1]
    assert firsts and min(firsts) < "09:00", "the early starter does not start before 09:00"


def check_short_overload(inp, out, calls):
    assert any(s["flag"] == "OVER CAPACITY" for s in _scheduled(out)), "the short day is not flagged over capacity"
```

- [ ] **Step 4: Regenerate and verify** (same command as Task 3 step 5). Expected: legacy untouched, DS-1 identical.

- [ ] **Step 5: Write the failing TypeScript tests.** Append to `route.test.ts`:

```ts
describe('per-technician usable minutes', () => {
  it("fits uses the route's own limit instead of the shared one", () => {
    const ctx = ctxFor([1])
    const r = new Route(0, 0, 100)
    r.service = 30
    expect(fits(ctx, r, 0, 0)).toBe(false) // 30 + 75 > 100
    r.service = 20
    expect(fits(ctx, r, 0, 0)).toBe(true) // 20 + 75 <= 100
  })
})
```

Append to `check.test.ts`:

```ts
  it('rejects negative per-technician hours', () => {
    const input = testInput({ places: [place], technicians: [{ ...tech, usableMin: -5 }], cases: [aCase] })
    expect(() => plan(input)).toThrow('technicians[0].usableMin')
  })
```

Run both files. Expected: FAIL.

- [ ] **Step 6: TypeScript implementation.** `types.ts` `Technician` gains:

```ts
  /** Working hours of this technician. Absent: the shared setting. */
  dayStartMin?: number
  usableMin?: number
  lunchStartMin?: number
  breakMin?: number
```

`context.ts`: `TechPlan` becomes `{ startNode, endNode, usableMin, dayStartMin, lunchStartMin, breakMin }`; build with `usableMin: t.usableMin ?? s.usableMin, dayStartMin: t.dayStartMin ?? s.dayStartMin, lunchStartMin: t.lunchStartMin ?? s.lunchStartMin, breakMin: t.breakMin ?? s.breakMin` (`const s = input.settings`).

`route.ts`: add `readonly usableMin: number | undefined`, constructor `(startNode = 0, endNode = 0, usableMin?: number)` setting it; in `fits`: `const usable = r.usableMin ?? ctx.s.usableMin` and `if (r.travel + delta + r.service + wt.serviceMin > usable + 1e-6) return false`.

`plan.ts`: `new Route(tp.startNode, tp.endNode, tp.usableMin)` with `const tp = ctx.techPlan[t]`.

`finalise.ts`: at the top of the route loop `const tp = ctx.techPlan[t]`; `let clock = tp.dayStartMin`; over-capacity uses `tp.usableMin`; lunch uses `tp.lunchStartMin`, break `tp.breakMin`.

`check.ts` (technician block): `for (const [k, v] of [['dayStartMin', t.dayStartMin], ['usableMin', t.usableMin], ['lunchStartMin', t.lunchStartMin], ['breakMin', t.breakMin]] as const) if (v !== undefined) needNum(\`technicians[${i}].${k}\`, v, 0)`.

- [ ] **Step 7: Run, full check, commit**

Run `npx vitest run src/engine` (expected PASS, new scenarios identical), then the full local check.

```bash
git add reference src
git commit -m "feat(engine): working hours and breaks per technician" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Push and request pull request 1.** `git push -u origin engine-step-2`. Then wait for the owner to open the PR from `https://github.com/rudrakshk21/ac-service-scheduler/pull/new/engine-step-2` (no `gh` on this PC). Continue with Task 5 on a new branch `engine-step-2b` created from this one, so work is not blocked.

---

### Task 5: Slice 4, priority levels

**Files:**
- Modify: `reference/python/engine.py`, `reference/convert.py`, `reference/scenarios_step2.py`, `reference/export_golden.py`, `src/engine/types.ts`, `check.ts`, `context.ts`, `plan.ts`, `finalise.ts`, `src/engine/check.test.ts`

**Interfaces:**
- JSON: `settings.priorityLevels?: { name: string; weight: number }[]` (default `[Normal 0, Escalated 100000]`), `cases[].priority?: number`, `cases[].escalated` becomes optional (absent = false; true = last level).
- Python: `Cfg.prio_names`, `Cfg.prio_w`; `CaseIn.prio: int = -1`; `Engine.weight: list[float]` (level weight per case).
- TypeScript: `PriorityLevel`, `Settings.priorityLevels?`, `CaseIn.priority?`, `Ctx.caseWeight: number[]`.

- [ ] **Step 1: Python.** `Cfg`: `prio_names: list = field(default_factory=lambda: ["Normal", "Escalated"])`, `prio_w: list = field(default_factory=lambda: [0.0, 100000.0])`. `CaseIn`: `prio: int = -1`. In `Engine.__init__` (end):

```python
        self.weight = []
        for k in cases:
            level = k.prio if k.prio >= 0 else (len(cfg.prio_w) - 1 if k.esc else 0)
            self.weight.append(cfg.prio_w[level])
```

In `greedy` replace the `bonus` line with `bonus = age * C.age_w + self.weight[c]`. In `finalise`, build the reason into a variable and append the level only when the case uses the new field:

```python
                        why = "Skill match (%s approved for %s); %s; route of %d stop%s in %s" % (
                            self.techs[t].name, C.cat_names[self.cases[c].cat],
                            "no extra travel" if detour < 1 else "adds %d min detour" % int(round(detour)),
                            len(r.stops), "s" if len(r.stops) > 1 else "", self.zone[self.cases[c].area])
                        if self.cases[c].prio >= 0:
                            why += "; priority " + C.prio_names[self.cases[c].prio]
                        res.why[c] = why
```

- [ ] **Step 2: `convert.py`.** Before `cfg = ...` add `levels = s.get("priorityLevels") or [{"name": "Normal", "weight": 0.0}, {"name": "Escalated", "weight": 100000.0}]`. Add to `Cfg(...)`: `prio_names=[l["name"] for l in levels], prio_w=[float(l["weight"]) for l in levels],`. In `CaseIn(...)`: `esc=c.get("escalated", False)` and `prio=c.get("priority", -1)`.

- [ ] **Step 3: Scenarios** (append, register):

```python
LEVELS_4 = [{"name": "Low", "weight": 0.0}, {"name": "Normal", "weight": 0.0},
            {"name": "High", "weight": 150.0}, {"name": "Emergency", "weight": 100000.0}]


def priority_levels():
    inp = base(28, 80, 9, 12)
    inp["settings"]["priorityLevels"] = copy.deepcopy(LEVELS_4)
    for i, c in enumerate(inp["cases"]):
        c["priority"] = 3 if i % 7 == 0 else 2 if i % 5 == 0 else 0 if i % 4 == 0 else 1
    return inp


def escalated_on_custom_levels():
    inp = base(29, 60, 9, 12)
    inp["settings"]["priorityLevels"] = copy.deepcopy(LEVELS_4)
    for i in (2, 9, 17):
        inp["cases"][i]["escalated"] = True
    return inp
```

Checks (register):

```python
def check_priority_levels(inp, out, calls):
    top = {c["id"] for c in inp["cases"] if c["priority"] == 3}
    firsts = [s for s in _scheduled(out) if s["id"] in top and s["day"] == START]
    assert firsts, "no emergency case on the first day"
    assert all(s["why"].endswith("; priority Emergency") for s in _scheduled(out) if s["id"] in top)


def check_escalated_custom(inp, out, calls):
    ids = {c["id"] for c in inp["cases"] if c.get("escalated")}
    assert any(s["id"] in ids and s["day"] == START for s in _scheduled(out)), "escalated case not on the first day"
    assert not any("; priority" in s["why"] for s in _scheduled(out)), "old-style cases must not name a level"
```

- [ ] **Step 4: Regenerate and verify** (Task 3 step 5 command). Expected: legacy untouched; DS-1 identical.

- [ ] **Step 5: Failing TypeScript tests.** Append to `check.test.ts`:

```ts
  it('names the case and the number of levels when a priority does not exist', () => {
    const input = testInput({ places: [place], technicians: [tech], cases: [{ ...aCase, priority: 5 }] })
    expect(() => plan(input)).toThrow('cases[0].priority is 5 but only 2 priority levels exist')
  })
  it('rejects a level without a name or with a negative weight', () => {
    const base = { places: [place], technicians: [tech], cases: [aCase] }
    expect(() => plan(testInput({ ...base, settings: { ...testInput().settings, priorityLevels: [{ name: '', weight: 0 }] } }))).toThrow('priorityLevels[0].name')
    expect(() => plan(testInput({ ...base, settings: { ...testInput().settings, priorityLevels: [{ name: 'A', weight: -1 }] } }))).toThrow('priorityLevels[0].weight')
  })
```

Append to `plan.test.ts` (inside the `describe`):

```ts
  it('plans a high-priority level first and names it in the reason', () => {
    const levels = [{ name: 'Low', weight: 0 }, { name: 'Emergency', weight: 100000 }]
    const cases = [aCase('1', 0), aCase('2', 0), aCase('3', 0), aCase('4', 0, { priority: 1 })]
    const r = plan(testInput({
      settings: testSettings({ priorityLevels: levels }), places: [here], technicians: [tech('T', [0])], cases,
    }))
    const s = r.scheduled.find((x) => x.id === '4')
    expect(s?.day).toBe(START)
    expect(s?.why.endsWith('; priority Emergency')).toBe(true)
    expect(r.scheduled.find((x) => x.id === '1')?.why.includes('priority')).toBe(false)
  })
```

Run them. Expected: FAIL.

- [ ] **Step 6: TypeScript implementation.** `types.ts`:

```ts
export interface PriorityLevel {
  name: string
  weight: number
}
```

`Settings` gains `priorityLevels?: PriorityLevel[]`. `CaseIn`: change `escalated: boolean` to `escalated?: boolean` and add `/** Index into the priority levels. Absent: the last level when \`escalated\`, otherwise level 0. */ priority?: number`.

`context.ts`: export `DEFAULT_LEVELS`, add `levels: PriorityLevel[]` and `caseWeight: number[]` to `Ctx`:

```ts
export const DEFAULT_LEVELS: PriorityLevel[] = [
  { name: 'Normal', weight: 0 },
  { name: 'Escalated', weight: 100000 },
]
```

built as `const levels = s.priorityLevels ?? DEFAULT_LEVELS` and `caseWeight: input.cases.map((c) => levels[c.priority ?? (c.escalated === true ? levels.length - 1 : 0)].weight)`.

`plan.ts` greedy: `const bonus = age * ctx.s.ageWeight + ctx.caseWeight[c]`.

`finalise.ts`: build `why` in a variable and, when `ctx.cases[c].priority !== undefined`, append `` `; priority ${ctx.levels[ctx.cases[c].priority].name}` ``.

`check.ts`: change `needBool(cases[i].escalated)` to `if (c.escalated !== undefined) needBool(...)`. Add before the work types block:

```ts
  const levels = s.priorityLevels ?? [{ name: 'Normal', weight: 0 }, { name: 'Escalated', weight: 100000 }]
  if (levels.length === 0) fail('settings.priorityLevels', 'must list at least one level')
  levels.forEach((l, i) => {
    needText(`settings.priorityLevels[${i}].name`, l.name)
    needNum(`settings.priorityLevels[${i}].weight`, l.weight, 0)
  })
```

and in the case loop: `if (c.priority !== undefined) { needInt(\`cases[${i}].priority\`, c.priority, 0); if (c.priority >= levels.length) fail(\`cases[${i}].priority\`, \`is ${c.priority} but only ${levels.length} priority levels exist\`) }`.

- [ ] **Step 7: Run, full check, commit**

```bash
git add reference src
git commit -m "feat(engine): configurable priority levels with weights" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Slice 5, soft due dates

**Files:** same set as Task 5 (engine.py, convert.py, scenarios_step2.py, export_golden.py, types.ts, check.ts, context.ts, plan.ts, finalise.ts, check.test.ts, plan.test.ts).

**Interfaces:**
- JSON: `cases[].dueDay?: number`, `settings.dueWeight?: number` (default 8), `settings.urgencyWindowDays?: number` (default 5).
- Python: `CaseIn.due: dt.date | None`, `Cfg.due_w`, `Cfg.due_window`.
- TypeScript: `Ctx.dueWeight`, `Ctx.dueWindow`.
- Output: flag `LATE BY n DAY(S)` (joined with `OVER CAPACITY` by `; `); unscheduled reason gets `; due date missed` for horizon cases with a due day.

- [ ] **Step 1: Python.** `Cfg`: `due_w: float = 8.0`, `due_window: float = 5.0`. `CaseIn`: `due: dt.date | None = None`. In `greedy`, after the `bonus` line:

```python
                if cs.due is not None:
                    bonus += C.due_w * min(90.0, max(0.0, C.due_window - (cs.due - day).days))
```

In `plan()` replace the final loop:

```python
        for c in left:
            res.unscheduled.add(c)
            reason = "Beyond planning horizon (%d working days) or does not fit in a day" % C.horizon
            if self.cases[c].due is not None:
                reason += "; due date missed"
            res.unsched_reason.setdefault(c, reason)
```

In `finalise`, inside the stop loop right after `clock += self.C...`/`res.visit[c] = i + 1` lines (before the `why` block) add:

```python
                    due = self.cases[c].due
                    if due is not None and day > due:
                        n = (day - due).days
                        late = "LATE BY %d DAY%s" % (n, "" if n == 1 else "S")
                        res.flag[c] = res.flag[c] + "; " + late if c in res.flag else late
```

- [ ] **Step 2: `convert.py`.** `Cfg(...)` gets `due_w=float(s.get("dueWeight", 8.0)), due_window=float(s.get("urgencyWindowDays", 5.0)),`; `CaseIn(...)` gets `due=day_date(c["dueDay"]) if "dueDay" in c else None,`.

- [ ] **Step 3: Scenarios** (append, register):

```python
def due_dates():
    inp = base(30, 70, 6, 10, horizonDays=4)
    for i, c in enumerate(inp["cases"]):
        if i % 11 == 0:
            c["dueDay"] = START - 3
        elif i % 3 == 0:
            c["dueDay"] = START + (i % 6)
    return inp


def due_dates_strong():
    inp = base(30, 70, 6, 10, horizonDays=4, dueWeight=40.0, urgencyWindowDays=10.0)
    for i, c in enumerate(inp["cases"]):
        if i % 11 == 0:
            c["dueDay"] = START - 3
        elif i % 3 == 0:
            c["dueDay"] = START + (i % 6)
    return inp
```

(`settings(**over)` accepts the extra keys.) Checks (register for both names):

```python
def check_due(inp, out, calls):
    due = {c["id"]: c["dueDay"] for c in inp["cases"] if "dueDay" in c}
    late = [s for s in _scheduled(out) if "LATE BY" in s["flag"]]
    assert late, "no visit is late"
    assert all(s["id"] in due and s["day"] > due[s["id"]] for s in late), "late flag on a case that is not late"
    assert all(s["day"] <= due[s["id"]] or "LATE BY" in s["flag"] for s in _scheduled(out) if s["id"] in due)
    assert any(u["reason"].endswith("; due date missed") for u in out["unscheduled"]), "no case missed its due date"
```

- [ ] **Step 4: Regenerate and verify** (Task 3 step 5 command). Expected: legacy untouched; DS-1 identical.

- [ ] **Step 5: Failing TypeScript tests.** `plan.test.ts`:

```ts
  it('flags a visit after its due day and leaves other cases alone', () => {
    const r = plan(testInput({
      places: [here], technicians: [tech('T', [0])],
      cases: ['1', '2', '3', '4'].map((id, i) => aCase(id, 0, i === 3 ? { dueDay: START - 2 } : {})),
    }))
    const late = r.scheduled.find((s) => s.id === '4')
    expect(late?.flag).toBe('LATE BY 2 DAYS')
    expect(r.scheduled.filter((s) => s.flag !== '').length).toBe(1)
  })

  it('pulls a case with a near due day ahead of cases that have waited longer', () => {
    // All at one place, so only the bonuses decide: age 2 days = 8 points, due today = 8 x 5 = 40 points.
    const waited = (id: string) => aCase(id, 0, { reportedDay: START - 2 })
    const plain = [waited('1'), waited('2'), waited('3'), aCase('4', 0)]
    const urgent = [waited('1'), waited('2'), waited('3'), aCase('4', 0, { dueDay: START })]
    const dayOfFour = (cases: object[]) =>
      plan(testInput({ places: [here], technicians: [tech('T', [0])], cases: cases as ReturnType<typeof aCase>[] }))
        .scheduled.find((s) => s.id === '4')?.day
    expect(dayOfFour(plain)).toBe(START + 1) // the ceiling is 3 a day and the others are older
    expect(dayOfFour(urgent)).toBe(START) // the due date pulls it into the first day
  })

  it('adds "due date missed" to a case that never fits', () => {
    const r = plan(testInput({
      settings: testSettings({ horizonDays: 1 }), places: [here], technicians: [tech('T', [0])],
      cases: ['1', '2', '3', '4'].map((id) => aCase(id, 0, { dueDay: START })),
    }))
    expect(r.unscheduled[0].reason).toBe('Beyond planning horizon (1 working days) or does not fit in a day; due date missed')
  })
```

`check.test.ts`: `expect(() => plan(...{ ...aCase, dueDay: 1.5 })).toThrow('cases[0].dueDay')`, and `settings.dueWeight: -1` throws `settings.dueWeight`.

Run. Expected: FAIL.

- [ ] **Step 6: TypeScript implementation.** `types.ts`: `Settings` gains `dueWeight?: number` and `urgencyWindowDays?: number`; `CaseIn` gains `/** Day the visit is promised by. Soft: visits after it are flagged late. */ dueDay?: number`. `context.ts`: `dueWeight: s.dueWeight ?? 8`, `dueWindow: s.urgencyWindowDays ?? 5` on `Ctx`. `plan.ts` greedy:

```ts
      let bonus = age * ctx.s.ageWeight + ctx.caseWeight[c]
      if (cs.dueDay !== undefined) {
        bonus += ctx.dueWeight * Math.min(90.0, Math.max(0.0, ctx.dueWindow - (cs.dueDay - day)))
      }
```

and in the final unscheduled loop: `let reason = \`Beyond planning horizon (...)\`; if (ctx.cases[c].dueDay !== undefined) reason += '; due date missed'`. `finalise.ts` stop loop:

```ts
        const due = ctx.cases[c].dueDay
        if (due !== undefined && day > due) {
          const n = day - due
          const late = `LATE BY ${n} DAY${n === 1 ? '' : 'S'}`
          const had = res.flag.get(c)
          res.flag.set(c, had === undefined ? late : `${had}; ${late}`)
        }
```

`check.ts`: settings `if (s.dueWeight !== undefined) needNum('settings.dueWeight', s.dueWeight, 0)`, same for `urgencyWindowDays`; cases `if (c.dueDay !== undefined) needInt(\`cases[${i}].dueDay\`, c.dueDay, -1_000_000)`.

- [ ] **Step 7: Run, full check, commit**

```bash
git add reference src
git commit -m "feat(engine): soft due dates with urgency and late flags" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Slice 6, visit time by product

**Files:** engine.py, convert.py, scenarios_step2.py, export_golden.py, types.ts, check.ts, context.ts, route.ts, finalise.ts, plus tests.

**Interfaces:**
- JSON: `productTypes?: { name: string; addMin?: number; factor?: number }[]` (top level), `cases[].productType?: number`, `cases[].serviceMin?: number` (override).
- Python: `Cfg.products: list[(add, factor)]`, `CaseIn.product: int = -1`, `CaseIn.svc_override: float | None`, `Engine.svc: list[float]` (visit minutes per case).
- TypeScript: `ProductType`, `PlanInput.productTypes?`, `visitMinutes(input, c)` exported from `context.ts`, `Ctx.caseService: number[]`.

- [ ] **Step 1: Python.** `Cfg`: `products: list = field(default_factory=list)`. `CaseIn`: `product: int = -1`, `svc_override: float | None = None`. In `Engine.__init__` (end):

```python
        self.svc = []
        for k in cases:
            if k.svc_override is not None:
                m = k.svc_override
            else:
                m = cfg.svc_min[k.cat]
                if k.product >= 0:
                    add, factor = cfg.products[k.product]
                    m = m * factor + add
            self.svc.append(m)
```

Replace every `self.C.svc_min[cat]` / `C.svc_min[self.cases[c].cat]` use with `self.svc[c]`: in `fits` (`... + r.service + self.svc[c] > usable + 1e-6`), `recalc` (`r.service += self.svc[c]`), `finalise` (`clock += self.svc[c]`). `recalc`'s loop variable `cat` becomes unused for the service line but still used for `frac`.

- [ ] **Step 2: `convert.py`.** `Cfg(...)` gets `products=[(float(p.get("addMin", 0.0)), float(p.get("factor", 1.0))) for p in inp.get("productTypes", [])],`; `CaseIn(...)` gets `product=c.get("productType", -1), svc_override=c.get("serviceMin"),`.

- [ ] **Step 3: Scenario** (append, register):

```python
def product_types():
    inp = base(31, 60, 9, 12)
    inp["productTypes"] = [{"name": "Split"}, {"name": "Cassette", "addMin": 30.0},
                           {"name": "Ducted", "factor": 1.5, "addMin": 15.0}]
    for i, c in enumerate(inp["cases"]):
        if i % 2 == 0:
            c["productType"] = i % 3
        if i % 13 == 0:
            c["serviceMin"] = 45.0
    return inp
```

Check (register):

```python
def check_products(inp, out, calls):
    cases = {c["id"]: c for c in inp["cases"]}
    wts = inp["workTypes"]
    prods = inp["productTypes"]

    def minutes(c):
        if "serviceMin" in c:
            return c["serviceMin"]
        m = wts[c["workType"]]["serviceMin"]
        if "productType" in c:
            p = prods[c["productType"]]
            m = m * p.get("factor", 1.0) + p.get("addMin", 0.0)
        return m

    for r in out["routes"]:
        assert abs(sum(minutes(cases[i]) for i in r["stops"]) - r["serviceMin"]) < 1e-9, "route minutes do not add up"
    assert any("serviceMin" in cases[s["id"]] for s in _scheduled(out)), "no overridden case was scheduled"
```

- [ ] **Step 4: Regenerate and verify** (Task 3 step 5 command).

- [ ] **Step 5: Failing TypeScript tests.** `plan.test.ts`:

```ts
  it('uses product minutes and a per-case override for visit time', () => {
    const r = plan(testInput({
      places: [here], technicians: [tech('T', [0])],
      productTypes: [{ name: 'Cassette', addMin: 30 }, { name: 'Ducted', factor: 1.5, addMin: 15 }],
      cases: [aCase('1', 0, { productType: 0 }), aCase('2', 0, { productType: 1 }), aCase('3', 0, { serviceMin: 45 })],
    }))
    const route = r.routes.find((x) => x.stops.length === 3)
    expect(route?.serviceMin).toBe(150 + 195 + 45)
  })
```

`check.test.ts`: `productType: 4` with two product types throws `cases[0].productType is 4 but only 2 product types exist`; `serviceMin: -1` throws `cases[0].serviceMin`; `productTypes[0].factor: 0` throws `productTypes[0].factor`.

Run. Expected: FAIL.

- [ ] **Step 6: TypeScript implementation.** `types.ts`:

```ts
export interface ProductType {
  name: string
  /** Minutes added to the work type's visit time. Default 0. */
  addMin?: number
  /** Multiplier of the work type's visit time. Default 1. */
  factor?: number
}
```

`PlanInput` gains `productTypes?: ProductType[]`; `CaseIn` gains `productType?: number` and `serviceMin?: number`. `context.ts`:

```ts
/** Visit minutes of a case: its own override, else work-type minutes x product factor + product minutes. */
export function visitMinutes(input: PlanInput, c: CaseIn): number {
  if (c.serviceMin !== undefined) return c.serviceMin
  let m = input.workTypes[c.workType].serviceMin
  if (c.productType !== undefined) {
    const p = input.productTypes?.[c.productType]
    if (p !== undefined) m = m * (p.factor ?? 1) + (p.addMin ?? 0)
  }
  return m
}
```

`Ctx.caseService: number[]` = `input.cases.map((c) => visitMinutes(input, c))`. `route.ts`: `fits` uses `ctx.caseService[c]` instead of `wt.serviceMin`; `recalc` uses `r.service += ctx.caseService[c]`. `finalise.ts`: `clock += ctx.caseService[c]`. `check.ts`: product block and case checks (messages as in the test).

- [ ] **Step 7: Run, full check, commit**

```bash
git add reference src
git commit -m "feat(engine): visit time by product type with a per-case override" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Extended random inputs and safety rules

**Files:**
- Modify: `src/engine/testing/generate.ts`, `src/engine/testing/invariants.ts`, `src/engine/invariants.test.ts`

**Interfaces:**
- Consumes: `visitMinutes` from `context.ts`.
- Produces: `generateInput(seed, nPlaces, nTechs, nCases, extended = false)`; `checkInvariants` also checks INV-3 with per-technician usable minutes, INV-7 (late flag iff day after due day), INV-8 (route on-site minutes equal the sum of visit minutes).

- [ ] **Step 1: Write the failing test.** Add to `invariants.test.ts`:

```ts
  it('INV-1 to INV-8 also hold when every step 2 feature is in use', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 2, max: 6 }),
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 0, max: 30 }),
        (seed, nPlaces, nTechs, nCases) => {
          const input = generateInput(seed, nPlaces, nTechs, nCases, true)
          const result = plan(input)
          expect(checkInvariants(input, result)).toEqual([])
          expect(plan(input)).toEqual(result)
        },
      ),
      { numRuns: 200 },
    )
  })
```

Run. Expected: FAIL (the fifth argument does not exist).

- [ ] **Step 2: `generate.ts`.** Add the parameter `extended = false` and, just before the final `return`, only when `extended`:

```ts
  let productTypes: PlanInput['productTypes']
  let priorityLevels: PlanInput['settings']['priorityLevels']
  if (extended) {
    priorityLevels = [{ name: 'Low', weight: 0 }, { name: 'High', weight: 150 }, { name: 'Emergency', weight: 100000 }]
    productTypes = [{ name: 'Split' }, { name: 'Cassette', addMin: 30 }, { name: 'Ducted', factor: 1.5, addMin: 15 }]
    for (const t of technicians) {
      if (r() < 0.3) t.startPlace = int(0, nPlaces - 1)
      if (r() < 0.3) t.endPlace = int(0, nPlaces - 1)
      if (r() < 0.3) t.usableMin = int(240, 480)
      if (r() < 0.3) t.dayStartMin = int(480, 600)
      if (r() < 0.2) t.breakMin = int(0, 60)
    }
    for (const c of cases) {
      if (r() < 0.5) c.priority = int(0, 2)
      if (r() < 0.5) c.dueDay = START + int(-3, 10)
      if (r() < 0.4) c.productType = int(0, 2)
      if (r() < 0.1) c.serviceMin = int(20, 90)
    }
  }
```

`cases` must be typed `CaseIn[]` (import the type) so the optional fields can be assigned; include `settings: testSettings({ ..., ...(priorityLevels ? { priorityLevels } : {}) })` and `...(productTypes ? { productTypes } : {})` in the returned object. The draw order for `extended = false` is unchanged, so legacy seeds give the same inputs.

- [ ] **Step 3: `invariants.ts`.** Import `visitMinutes` is not needed (compute independently from the input): add inside the file

```ts
function minutesOf(input: PlanInput, id: string): number {
  const c = input.cases.find((x) => x.id === id)
  if (c === undefined) return 0
  if (c.serviceMin !== undefined) return c.serviceMin
  let m = input.workTypes[c.workType].serviceMin
  const p = c.productType === undefined ? undefined : input.productTypes?.[c.productType]
  if (p !== undefined) m = m * (p.factor ?? 1) + (p.addMin ?? 0)
  return m
}
```

Change INV-3 to `const usable = input.technicians[r.tech].usableMin ?? input.settings.usableMin` and compare with `usable + 1e-6`. Add INV-8 in the same loop: `const sum = r.stops.reduce((a, id) => a + minutesOf(input, id), 0); if (Math.abs(sum - r.serviceMin) > 1e-6) problems.push(...)`. Add INV-7 in the scheduled loop:

```ts
    const late = c.dueDay !== undefined && s.day > c.dueDay
    if (late !== s.flag.includes('LATE BY')) problems.push(`INV-7: case ${s.id} late flag is wrong (day ${s.day}, due ${c.dueDay})`)
```

Update the doc comment of the function to mention INV-7 and INV-8.

- [ ] **Step 4: Run, full check, commit**

Expected: the new property test passes; if it finds a counterexample, treat it as a real engine or rule bug and fix the engine (and the Python reference first) rather than weakening the rule.

```bash
git add src
git commit -m "test(engine): random inputs and safety rules for every step 2 feature" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Speed measurement, documents, pull request 2

**Files:**
- Create: `src/engine/speed.measure.test.ts`
- Modify: `docs/superpowers/specs/2026-11-19-planning-engine-design.md`, `docs/superpowers/specs/2026-11-20-engine-step-2-design.md`, `reference/README.md`

- [ ] **Step 1: Create `src/engine/speed.measure.test.ts`**

```ts
import { describe, it } from 'vitest'
import { plan } from './index'
import { generateInput } from './testing/generate'

// Opt-in: VITE_MEASURE_SPEED=1 npx vitest run src/engine/speed.measure.test.ts
describe.skipIf(import.meta.env.VITE_MEASURE_SPEED !== '1')('planning time at the target size (NFR-4)', () => {
  it('measures 2,000 cases, 100 technicians, 60 places', () => {
    const input = generateInput(2026, 60, 100, 2000, true)
    const started = performance.now()
    const result = plan(input)
    const seconds = (performance.now() - started) / 1000
    console.log(`SPEED: ${result.scheduled.length} scheduled, ${result.unscheduled.length} unscheduled, ${seconds.toFixed(2)} s`)
  }, 600_000)
})
```

- [ ] **Step 2: Run it and record the numbers**

Run (PowerShell): `$env:VITE_MEASURE_SPEED='1'; npx vitest run src/engine/speed.measure.test.ts; Remove-Item Env:VITE_MEASURE_SPEED`
Expected: a `SPEED:` line. Write the number in section 6 of the step 2 design as "Measured on 2026-11-20 ...", and judge against NFR-4. Do not optimise in this step.

- [ ] **Step 3: Update documents.** In `2026-11-19-planning-engine-design.md` replace the section 3 interface with the step 2 field list (optional fields noted), set Status to "step 1 and step 2 implemented"; in the step 2 design set Status to "implemented" and add the measured speed. In `reference/README.md` list the new files (`scenarios_step2.py`, `check_ds1_local.py`, `LEGACY.sha256`) and the rule that legacy golden files must never change.

- [ ] **Step 4: Full local check, `npm run build`, commit, push**

```bash
git add docs reference src
git commit -m "docs: finish engine step 2 (speed measurement, interface, reference notes)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin engine-step-2b
```

Then ask the owner to open pull request 2 from `https://github.com/rudrakshk21/ac-service-scheduler/pull/new/engine-step-2b`, wait for all checks green, and merge only on the owner's click or word.

---

## Self-Review

- **Spec coverage:** 4.1 to Task 2; 4.2 to Task 3; 4.3 to Task 4; 4.4 to Task 5; 4.5 to Task 6; 4.6 to Task 7; 4.7 (input checks) inside each slice; section 3 (compatibility, checksum) to Task 1 and each slice's "legacy untouched" step; section 5 testing to Tasks 1 to 8; section 6 (speed) and 7 (delivery) to Task 4 step 8 and Task 9; finish line covered by the full local check and the DS-1 script.
- **Placeholders:** none. Expected values in the new TypeScript tests were worked out by hand (comments show the arithmetic); if a test disagrees with the engine, first re-check that arithmetic and the Python reference before changing either side.
- **Type consistency:** `TechPlan` grows in Task 4 (Task 3 defines `startNode`/`endNode` only); `Route` constructor `(startNode, endNode, usableMin?)`; `visitMinutes(input, c)` exported from `context.ts` in Task 7 and reimplemented independently in `invariants.ts` (`minutesOf`) on purpose; `Ctx` gains `techPlan`, `levels`, `caseWeight`, `dueWeight`, `dueWindow`, `caseService` across tasks 3 to 7.

## Execution notes (what differed from the plan)

- `src/engine/check.test.ts` already existed from step 1 and is a table of rejected inputs. The step 2 checks were
  added as table rows, not as a new file (a first attempt to create the file was reverted from Git before commit).
- The `due_dates` scenarios use 110 cases and a 2-day horizon (not 70 cases and 4 days): with 70 cases everything
  fitted, and the scenario's own self-check ("some case missed its due date") caught it.
- A tie between two equally cheap insert positions goes to the earlier one (strict "less than", as in Python), so the
  route test asserts `front <= back`.
- Work was done on two branches: `engine-step-2` (tasks 1 to 4) and `engine-step-2b` (tasks 5 to 9, which contains the
  first branch's commits). To save the owner's clicks there is one pull request, from `engine-step-2b`; `engine-step-2`
  stays as a checkpoint and can be deleted.
- Speed measurement: five sizes instead of one (see the step 2 design, section 6).
