"""Synthetic planning scenarios for the golden files. Everything here is invented: a made-up region and
made-up names. Uses only random.Random.random(), whose output is stable across Python versions."""
import copy
import datetime as dt
import random

from convert import day_number

START = day_number(dt.date(2026, 10, 13))  # a Tuesday

WORK_TYPES = [
    {"name": "Installation", "serviceMin": 120.0, "dailyCeiling": 3.0, "requiredSkill": 0},
    {"name": "Service / RMS", "serviceMin": 75.0, "dailyCeiling": 5.0, "requiredSkill": 1},
    {"name": "Breakdown", "serviceMin": 75.0, "dailyCeiling": 5.0, "requiredSkill": 2},
]


class Rng:
    def __init__(self, seed):
        self._r = random.Random(seed)

    def random(self):
        return self._r.random()

    def int(self, a, b):
        return a + int(self._r.random() * (b - a + 1))

    def pick(self, weights):
        x = self._r.random() * sum(weights)
        acc = 0.0
        for i, w in enumerate(weights):
            acc += w
            if x < acc:
                return i
        return len(weights) - 1


def settings(**over):
    s = dict(baseLat=20.0, baseLon=30.0, speedKmh=30.0, roadFactor=1.35, sameAreaHopMin=10.0, usableMin=480.0,
             dayStartMin=540.0, lunchStartMin=780.0, breakMin=60.0, ageWeight=4.0, balanceWeight=0.05, maxKm=60.0,
             horizonDays=30, restWeekdays=[6], holidays=[], startDay=START)
    s.update(over)
    return s


def make_places(rng, n):
    return [{"name": "Place %02d" % (i + 1), "lat": round(20.0 + (rng.random() - 0.5) * 0.5, 5),
             "lon": round(30.0 + (rng.random() - 0.5) * 0.5, 5)} for i in range(n)]


def make_techs(n):
    return [{"name": "Technician %02d" % (i + 1), "skills": [i % 3], "active": True} for i in range(n)]


def make_cases(rng, n, n_places):
    return [{"id": str(100001 + i), "workType": rng.pick([29, 31, 40]), "place": rng.int(0, n_places - 1),
             "escalated": rng.random() < 0.03, "reportedDay": START - rng.int(0, 40)} for i in range(n)]


def base(seed, n_cases, n_techs, n_places, **settings_over):
    rng = Rng(seed)
    places = make_places(rng, n_places)
    cases = make_cases(rng, n_cases, n_places)
    return {"settings": settings(**settings_over), "workTypes": copy.deepcopy(WORK_TYPES),
            "technicians": make_techs(n_techs), "places": places, "cases": cases}


def tech_for_type(inp, work_type, nth=0):
    """Index of the nth technician who holds the skill of a work type."""
    return [i for i, t in enumerate(inp["technicians"]) if work_type in t["skills"]][nth]


def baseline_mid():
    return base(1, 70, 9, 14)


def tech_inactive():
    inp = base(1, 70, 9, 14)
    inp["technicians"][1]["active"] = False
    return inp


def tech_leave():
    inp = base(1, 70, 9, 14)
    inp["technicians"][2]["leaveFrom"] = START
    inp["technicians"][2]["leaveTo"] = START + 2
    return inp


def three_techs_default():
    return base(2, 90, 3, 10)


def holiday():
    return base(2, 90, 3, 10, holidays=[START + 2])


def sunday_work():
    return base(2, 90, 3, 10, restWeekdays=[])


def pins():
    inp = base(3, 60, 9, 12)
    cs = inp["cases"]
    cs[0]["workType"] = 0
    cs[0]["pinnedTech"] = tech_for_type(inp, 0, 0)
    cs[0]["earliestDay"] = START
    cs[1]["workType"] = 1
    cs[1]["pinnedTech"] = tech_for_type(inp, 1, 1)
    cs[1]["earliestDay"] = START + 1
    cs[2]["earliestDay"] = START + 2
    cs[3]["workType"] = 2
    cs[3]["pinnedTech"] = tech_for_type(inp, 2, 0)
    return inp


def frozen():
    inp = base(4, 60, 9, 12)
    for i in range(10):
        c = inp["cases"][i]
        c["frozenTech"] = tech_for_type(inp, c["workType"], i % 3)
    return inp


def escalated_many():
    inp = base(5, 80, 9, 12)
    for i in (3, 11, 19, 27, 35, 43):
        inp["cases"][i]["escalated"] = True
    return inp


def long_routes():
    inp = base(6, 45, 3, 3)
    for w in inp["workTypes"]:
        w["serviceMin"] = 10.0
        w["dailyCeiling"] = 40.0
    return inp


def overload_pin():
    inp = base(7, 30, 6, 8)
    for i in range(8):
        inp["cases"][i]["workType"] = 0
        inp["cases"][i]["pinnedTech"] = 0
        inp["cases"][i]["earliestDay"] = START
    return inp


def unscheduled_reasons():
    inp = base(8, 40, 6, 8, horizonDays=1)
    inp["technicians"][0]["active"] = False  # skills [0]
    inp["technicians"][3]["active"] = False  # skills [0]: nobody can do Installation any more
    c = inp["cases"][5]
    c["workType"] = 1
    c["pinnedTech"] = 2  # a Breakdown technician: not approved for Service
    return inp


def identical_places():
    inp = base(9, 50, 6, 4)
    first = inp["places"][0]
    for p in inp["places"][1:]:
        p["lat"], p["lon"] = first["lat"], first["lon"]
    return inp


def half_minutes():
    # Travel between different places is exactly half the hop (0.5 min), so arrival times land on .5.
    return base(10, 24, 6, 6, sameAreaHopMin=1.0, speedKmh=1.0e9)


def large_random_a():
    return base(11, 200, 20, 40)


def large_random_b():
    return base(12, 260, 12, 25)


SCENARIOS = {f.__name__: f for f in (
    baseline_mid, tech_inactive, tech_leave, three_techs_default, holiday, sunday_work, pins, frozen,
    escalated_many, long_routes, overload_pin, unscheduled_reasons, identical_places, half_minutes,
    large_random_a, large_random_b,
)}
