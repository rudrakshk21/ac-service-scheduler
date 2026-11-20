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
