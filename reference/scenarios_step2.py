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


STEP2 = {f.__name__: f for f in (
    five_work_types, skills_not_position, home_and_depot, home_to_home, long_routes_with_ends,
)}
