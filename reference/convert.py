"""Converts between the web engine's JSON shapes and the Python reference engine's own objects."""
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "python"))
import engine  # noqa: E402  (the reference engine, copied unchanged)

EPOCH = dt.date(1970, 1, 1)
EPS = 1e-9


def same(a, b, path="result"):
    """Returns a list of differences between two JSON values. Empty means the same.
    Real numbers match within one part in a billion; everything else must match exactly."""
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


def day_number(d):
    return (d - EPOCH).days


def day_date(n):
    return EPOCH + dt.timedelta(days=n)


def to_python(inp):
    """Builds the Python Engine for a PlanInput dict. The reference knows only three work types
    (required skill = work type), a Sunday rest day and a base start for every route."""
    s = inp["settings"]
    assert set(s["restWeekdays"]) <= {6}, "the Python reference only knows Sunday as a rest day"
    assert [w["requiredSkill"] for w in inp["workTypes"]] == [0, 1, 2], "the Python reference has exactly 3 work types"
    assert all("startPlace" not in t for t in inp["technicians"]), "the Python reference starts every route at the base"
    cfg = engine.Cfg(
        store_lat=s["baseLat"], store_lon=s["baseLon"], speed=s["speedKmh"], road_factor=s["roadFactor"],
        hop_min=s["sameAreaHopMin"], usable_min=s["usableMin"], age_w=s["ageWeight"], bal_w=s["balanceWeight"],
        max_km=s["maxKm"], start_min=s["dayStartMin"], lunch_min=s["lunchStartMin"], break_min=s["breakMin"],
        svc_min=[w["serviceMin"] for w in inp["workTypes"]], target=[w["dailyCeiling"] for w in inp["workTypes"]],
        horizon=s["horizonDays"], sundays=(6 not in s["restWeekdays"]), start=day_date(s["startDay"]),
        holidays={day_date(d) for d in s["holidays"]},
    )
    cases = [
        engine.CaseIn(
            id=c["id"], cat=c["workType"], area=c["place"], esc=c["escalated"], reported=day_date(c["reportedDay"]),
            req_tech=c.get("pinnedTech", -1),
            man_date=day_date(c["earliestDay"]) if "earliestDay" in c else None,
            freeze_tech=c.get("frozenTech", -1),
        )
        for c in inp["cases"]
    ]
    techs = [
        engine.TechIn(
            name=t["name"], skill=[i in t["skills"] for i in range(3)], active=t["active"],
            leave_from=day_date(t["leaveFrom"]) if "leaveFrom" in t else None,
            leave_to=day_date(t["leaveTo"]) if "leaveTo" in t else None,
        )
        for t in inp["technicians"]
    ]
    places = inp["places"]
    return engine.Engine(cfg, cases, techs, [p["name"] for p in places], [p["lat"] for p in places], [p["lon"] for p in places])


def from_python(eng, res):
    """The Python Result as the PlanResult dict. Order: cases in input order, routes by day then technician."""
    scheduled = []
    for i, c in enumerate(eng.cases):
        if i in res.date:
            scheduled.append({
                "id": c.id, "day": day_number(res.date[i]), "tech": res.tech[i], "visit": res.visit[i],
                "eta": res.eta[i], "travelMin": res.travel_min[i], "prevKm": res.prev_km[i],
                "why": res.why[i], "flag": res.flag.get(i, ""),
            })
    unscheduled = [{"id": eng.cases[i].id, "reason": res.unsched_reason.get(i, "")} for i in sorted(res.unscheduled)]
    routes = []
    for d in res.days:
        for t, r in res.routes[d].items():
            routes.append({
                "day": day_number(d), "tech": t, "stops": [eng.cases[c].id for c in r.stops],
                "travelMin": r.travel, "serviceMin": r.service, "load": r.frac,
            })
    return {"scheduled": scheduled, "unscheduled": unscheduled, "days": [day_number(d) for d in res.days], "routes": routes}


def to_input(eng):
    """A built Python Engine back to a PlanInput dict (used to export real data without hand conversion)."""
    c = eng.C
    technicians = []
    for t in eng.techs:
        out = {"name": t.name, "skills": [i for i, has in enumerate(t.skill) if has], "active": t.active}
        if t.leave_from:
            out["leaveFrom"] = day_number(t.leave_from)
        if t.leave_to:
            out["leaveTo"] = day_number(t.leave_to)
        technicians.append(out)
    cases = []
    for k in eng.cases:
        out = {"id": k.id, "workType": k.cat, "place": k.area, "escalated": k.esc, "reportedDay": day_number(k.reported)}
        if k.req_tech >= 0:
            out["pinnedTech"] = k.req_tech
        if k.man_date:
            out["earliestDay"] = day_number(k.man_date)
        if k.freeze_tech >= 0:
            out["frozenTech"] = k.freeze_tech
        cases.append(out)
    return {
        "settings": {
            "baseLat": c.store_lat, "baseLon": c.store_lon, "speedKmh": c.speed, "roadFactor": c.road_factor,
            "sameAreaHopMin": c.hop_min, "usableMin": c.usable_min, "dayStartMin": c.start_min,
            "lunchStartMin": c.lunch_min, "breakMin": c.break_min, "ageWeight": c.age_w, "balanceWeight": c.bal_w,
            "maxKm": c.max_km, "horizonDays": c.horizon, "restWeekdays": [] if c.sundays else [6],
            "holidays": sorted(day_number(d) for d in c.holidays), "startDay": day_number(c.start),
        },
        "workTypes": [
            {"name": engine.CAT_NAMES[i], "serviceMin": c.svc_min[i], "dailyCeiling": c.target[i], "requiredSkill": i}
            for i in range(3)
        ],
        "technicians": technicians,
        "places": [{"name": n, "lat": la, "lon": lo} for n, la, lo in zip(eng.area_name, eng.lat, eng.lon)],
        "cases": cases,
    }
