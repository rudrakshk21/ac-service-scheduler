"""Checks the reference tooling: every scenario exercises what it is for, and the committed
golden files are what the Python engine produces today.

Real numbers are compared with a tolerance of one part in a billion, like the TypeScript golden test:
the maths library of another operating system can differ in the last digits. Everything else
(technician, day, visit, arrival time, text, stop order) must match exactly."""
import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import export_golden  # noqa: E402

EPS = 1e-9


def same(a, b, path="result"):
    """Returns a list of differences between two JSON values. Empty means the same."""
    if isinstance(a, bool) or isinstance(b, bool) or a is None or b is None:
        return [] if a == b and type(a) is type(b) else ["%s: %r != %r" % (path, a, b)]
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        ok = abs(a - b) <= EPS * max(1.0, abs(a), abs(b))
        return [] if ok else ["%s: %r != %r" % (path, a, b)]
    if isinstance(a, dict) and isinstance(b, dict):
        if set(a) != set(b):
            return ["%s: keys %s != %s" % (path, sorted(a), sorted(b))]
        return [d for k in a for d in same(a[k], b[k], path + "." + k)]
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return ["%s: length %d != %d" % (path, len(a), len(b))]
        return [d for i, (x, y) in enumerate(zip(a, b)) for d in same(x, y, "%s[%d]" % (path, i))]
    return [] if a == b else ["%s: %r != %r" % (path, a, b)]


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
            diffs = same(on_disk, payload, name)
            self.assertEqual(diffs[:5], [], name + " is stale: run py reference/export_golden.py")


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
