"""Checks the reference tooling: every scenario exercises what it is for, and the committed
golden files are what the Python engine produces today.

Real numbers are compared with a tolerance of one part in a billion, like the TypeScript golden test.
Everything else (technician, day, visit, arrival time, text, stop order) must match exactly."""
import hashlib
import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import export_golden  # noqa: E402
import scenarios  # noqa: E402
from convert import engine, same  # noqa: E402


class ReferenceTooling(unittest.TestCase):
    def test_scenario_names_are_distinct_and_include_the_sixteen_originals(self):
        names = [name for name, _ in export_golden.build_all()]
        self.assertEqual(len(names), len(set(names)))
        self.assertEqual(len(scenarios.SCENARIOS), 16)
        self.assertTrue(set(scenarios.SCENARIOS) <= set(names))

    def test_golden_files_are_current(self):
        for name, payload in export_golden.build_all():
            path = export_golden.GOLDEN_DIR / (name + ".json")
            self.assertTrue(path.exists(), "missing golden file for " + name + ": run py reference/export_golden.py")
            on_disk = json.loads(path.read_text(encoding="utf-8"))
            diffs = same(on_disk, payload, name)
            self.assertEqual(diffs[:5], [], name + " is stale: run py reference/export_golden.py")


class LegacyGoldens(unittest.TestCase):
    """The 16 original golden files must never change: step 2 may only add scenarios."""

    def test_the_sixteen_original_files_are_byte_for_byte_unchanged(self):
        text = (export_golden.GOLDEN_DIR / "LEGACY.sha256").read_text(encoding="utf-8")
        entries = [line.split("  ") for line in text.split("\n") if line.strip()]
        self.assertEqual(sorted(name[:-5] for _, name in entries), sorted(scenarios.SCENARIOS))
        for digest, name in entries:
            data = (export_golden.GOLDEN_DIR / name).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(), digest, name + " changed: a slice altered an old plan")


class Rounding(unittest.TestCase):
    """snap() must round exactly like snapMinutes in src/engine/geo.ts (same cases as geo.test.ts)."""

    def test_snap_matches_the_web_engine_cases(self):
        for x, want in [(0, 0), (5, 5), (1.0000000004, 1), (1.0000000006, 1.000000001),
                        (30.0226324900004, 30.02263249), (12.3456789014999, 12.345678901),
                        (12.3456789015001, 12.345678902)]:
            self.assertEqual(engine.snap(x), want, x)

    def test_snap_is_idempotent(self):
        for x in (0.5, 17.123456789012, 99.999999999999, 1234.5678901234):
            self.assertEqual(engine.snap(engine.snap(x)), engine.snap(x))


class Comparison(unittest.TestCase):
    """The tolerant comparison must still catch every real difference."""

    def test_tiny_float_differences_are_allowed(self):
        self.assertEqual(same({"a": [1.0, 2.5]}, {"a": [1.0 + 1e-12, 2.5]}), [])
        self.assertEqual(same(120, 120.0), [])

    def test_real_differences_are_caught(self):
        self.assertTrue(same({"a": 1.0}, {"a": 1.001}))
        self.assertTrue(same({"eta": "09:05"}, {"eta": "09:06"}))
        self.assertTrue(same({"stops": ["1", "2"]}, {"stops": ["2", "1"]}))
        self.assertTrue(same({"a": 1}, {"b": 1}))
        self.assertTrue(same([1, 2], [1, 2, 3]))
        self.assertTrue(same({"ok": True}, {"ok": 1}))


if __name__ == "__main__":
    unittest.main()
