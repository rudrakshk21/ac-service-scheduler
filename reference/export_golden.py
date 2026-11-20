"""Writes the golden files: each scenario's input and the Python reference engine's complete plan.
Usage: py reference/export_golden.py"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import convert  # noqa: E402
from convert import engine, from_python, to_python  # noqa: E402
from scenarios import SCENARIOS, START  # noqa: E402
from scenarios_step2 import STEP2  # noqa: E402

GOLDEN_DIR = HERE / "golden"


def run_scenario(inp):
    """Runs the Python engine. Returns the PlanResult dict and every clock value passed to hm()."""
    calls = []
    original = engine.hm
    engine.hm = lambda minutes: (calls.append(minutes), original(minutes))[1]
    try:
        eng = to_python(inp)
        res = eng.plan()
    finally:
        engine.hm = original
    return from_python(eng, res), calls


def _is_sunday(day):
    return (day + 3) % 7 == 6


def _scheduled(out):
    return out["scheduled"]


def check_long_routes(inp, out, calls):
    assert max(len(r["stops"]) for r in out["routes"]) > 10, "no route has more than 10 stops"


def check_pins(inp, out, calls):
    assert any(s["why"] == "Manual assignment" for s in _scheduled(out)), "no pinned case was placed"


def check_frozen(inp, out, calls):
    assert any(s["why"].startswith("Kept from earlier plan") for s in _scheduled(out)), "no frozen case was kept"


def check_overload(inp, out, calls):
    assert any(s["flag"] == "OVER CAPACITY" for s in _scheduled(out)), "no day is over capacity"


def check_unscheduled(inp, out, calls):
    reasons = " | ".join(u["reason"] for u in out["unscheduled"])
    for text in ("No active technician has this skill", "Manual technician is not approved for this work type", "Beyond planning horizon"):
        assert text in reasons, "missing unscheduled reason: " + text


def check_half(inp, out, calls):
    assert any(abs(m % 1 - 0.5) < 1e-12 for m in calls), "no arrival time falls on exactly half a minute"


def check_escalated(inp, out, calls):
    ids = {c["id"] for c in inp["cases"] if c["escalated"]}
    assert any(s["id"] in ids and s["day"] == START for s in _scheduled(out)), "no escalated case on the first day"


def check_holiday(inp, out, calls):
    assert all(s["day"] != START + 2 for s in _scheduled(out)), "a visit falls on the holiday"
    assert max(s["day"] for s in _scheduled(out)) > START + 2, "the plan ends before the holiday"


def check_sunday_work(inp, out, calls):
    assert any(_is_sunday(s["day"]) for s in _scheduled(out)), "no visit falls on a Sunday"


def check_sunday_rest(inp, out, calls):
    assert not any(_is_sunday(s["day"]) for s in _scheduled(out)), "a visit falls on a Sunday"
    assert max(s["day"] for s in _scheduled(out)) > START + 5, "the plan ends before the first Sunday"


def check_inactive(inp, out, calls):
    assert all(s["tech"] != 1 for s in _scheduled(out)), "the inactive technician has a visit"


def check_leave(inp, out, calls):
    assert all(not (s["tech"] == 2 and START <= s["day"] <= START + 2) for s in _scheduled(out)), "visit during leave"


def check_large(inp, out, calls):
    assert len(_scheduled(out)) > 150, "too few cases scheduled"


def check_five(inp, out, calls):
    ids = {s["id"] for s in _scheduled(out)}
    kinds = {c["workType"] for c in inp["cases"] if c["id"] in ids}
    assert kinds == {0, 1, 2, 3, 4}, "not every work type was scheduled: %s" % sorted(kinds)


def check_skills_not_position(inp, out, calls):
    need = {i: w["requiredSkill"] for i, w in enumerate(inp["workTypes"])}
    cases = {c["id"]: c for c in inp["cases"]}
    for s in _scheduled(out):
        assert need[cases[s["id"]]["workType"]] in inp["technicians"][s["tech"]]["skills"], "wrong skill for " + s["id"]
    assert len(_scheduled(out)) > 40, "too few cases scheduled"


def check_ends(inp, out, calls):
    moved = {i for i, t in enumerate(inp["technicians"]) if t.get("startPlace", -1) != t.get("endPlace", -1)}
    assert any(s["tech"] in moved for s in _scheduled(out)), "no technician with different start and end was used"


def check_home_to_home(inp, out, calls):
    assert len(_scheduled(out)) > 30, "too few cases scheduled"
    firsts = [s for s in _scheduled(out) if s["visit"] == 1]
    assert any(s["prevKm"] == 0.0 for s in firsts), "no first stop sits at the technician's own start place"


def check_long_ends(inp, out, calls):
    assert max(len(r["stops"]) for r in out["routes"]) > 10, "no route has more than 10 stops"


def check_tech_hours(inp, out, calls):
    short = [r for r in out["routes"] if r["tech"] == 0 and r["stops"]]
    assert short, "the short-hours technician has no route"
    assert all(r["travelMin"] + r["serviceMin"] <= 240.0 + 1e-6 for r in short), "short-hours technician over 240 minutes"
    firsts = [s["eta"] for s in _scheduled(out) if s["tech"] == 1 and s["visit"] == 1]
    assert firsts and min(firsts) < "09:00", "the early starter does not start before 09:00"


def check_short_overload(inp, out, calls):
    assert any(s["flag"] == "OVER CAPACITY" for s in _scheduled(out)), "the short day is not flagged over capacity"


def check_priority_levels(inp, out, calls):
    top = {c["id"] for c in inp["cases"] if c["priority"] == 3}
    firsts = [s for s in _scheduled(out) if s["id"] in top and s["day"] == START]
    assert firsts, "no emergency case on the first day"
    assert all(s["why"].endswith("; priority Emergency") for s in _scheduled(out) if s["id"] in top)


def check_escalated_custom(inp, out, calls):
    ids = {c["id"] for c in inp["cases"] if c.get("escalated")}
    assert any(s["id"] in ids and s["day"] == START for s in _scheduled(out)), "escalated case not on the first day"
    assert not any("; priority" in s["why"] for s in _scheduled(out)), "old-style cases must not name a level"


def check_due(inp, out, calls):
    due = {c["id"]: c["dueDay"] for c in inp["cases"] if "dueDay" in c}
    late = [s for s in _scheduled(out) if "LATE BY" in s["flag"]]
    assert late, "no visit is late"
    assert all(s["id"] in due and s["day"] > due[s["id"]] for s in late), "late flag on a case that is not late"
    assert all(s["day"] <= due[s["id"]] or "LATE BY" in s["flag"] for s in _scheduled(out) if s["id"] in due)
    assert any(u["reason"].endswith("; due date missed") for u in out["unscheduled"]), "no case missed its due date"


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


CHECKS = {
    "product_types": check_products,
    "due_dates": check_due, "due_dates_strong": check_due,
    "priority_levels": check_priority_levels, "escalated_on_custom_levels": check_escalated_custom,
    "tech_hours": check_tech_hours, "short_day_overload": check_short_overload,
    "home_and_depot": check_ends, "home_to_home": check_home_to_home, "long_routes_with_ends": check_long_ends,
    "five_work_types": check_five, "skills_not_position": check_skills_not_position,
    "long_routes": check_long_routes, "pins": check_pins, "frozen": check_frozen, "overload_pin": check_overload,
    "unscheduled_reasons": check_unscheduled, "half_minutes": check_half, "escalated_many": check_escalated,
    "holiday": check_holiday, "sunday_work": check_sunday_work, "three_techs_default": check_sunday_rest,
    "tech_inactive": check_inactive, "tech_leave": check_leave, "large_random_a": check_large,
}


def build_all():
    """Runs every scenario and its self-check. Returns [(name, payload)]."""
    built = []
    for name, build in list(SCENARIOS.items()) + list(STEP2.items()):
        inp = build()
        result, calls = run_scenario(inp)
        check = CHECKS.get(name)
        if check:
            check(inp, result, calls)
        built.append((name, {"name": name, "input": inp, "expected": result}))
    return built


def main():
    GOLDEN_DIR.mkdir(exist_ok=True)
    for name, payload in build_all():
        (GOLDEN_DIR / (name + ".json")).write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
        out = payload["expected"]
        print("%-22s %4d scheduled, %3d unscheduled, %2d days" % (name, len(out["scheduled"]), len(out["unscheduled"]), len(out["days"])))


if __name__ == "__main__":
    main()
