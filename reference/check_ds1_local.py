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
