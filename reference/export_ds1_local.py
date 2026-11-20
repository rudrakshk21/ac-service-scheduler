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

    # The reference engine rounds travel times (snap); the project engine does not. Equal-length stop orders
    # can therefore come out in a different order. Nothing else may change: every case keeps its technician
    # and day, and the total travel stays the same.
    ref_eng = to_python(inp)
    ref_result = from_python(ref_eng, ref_eng.plan())
    old = {s["id"]: (s["day"], s["tech"]) for s in expected["scheduled"]}
    new = {s["id"]: (s["day"], s["tech"]) for s in ref_result["scheduled"]}
    moved = [k for k in old if new.get(k) != old[k]]
    assert not moved and len(old) == len(new), "the reference engine moved %d cases versus the project engine" % len(moved)
    old_travel = sum(r["travelMin"] for r in expected["routes"])
    new_travel = sum(r["travelMin"] for r in ref_result["routes"])
    assert abs(old_travel - new_travel) <= 1e-6 * max(1.0, old_travel), "total travel differs: %r vs %r" % (old_travel, new_travel)
    order_only = sum(1 for a, b in zip(expected["routes"], ref_result["routes"]) if a["stops"] != b["stops"])
    print("reference vs project engine: 0 cases moved, same total travel, %d routes in a different (equally short) order" % order_only)
    expected = ref_result

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
