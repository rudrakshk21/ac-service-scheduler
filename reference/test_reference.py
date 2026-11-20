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
