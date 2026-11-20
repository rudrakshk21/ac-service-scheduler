"""Planning engine: skill-aware, travel-aware assignment of cases to technicians over working days.

This is a line-by-line port of the C# engine (Core.cs) used by the Excel/PowerShell version, so both
produce the same plans. Standard library only.

Method (per working day):
  1. pinned cases (manual technician + date, or frozen from the previous plan) are placed first;
  2. greedy cheapest insertion: every eligible (case, technician) pair is scored
        score = extra travel minutes + balance_weight * technician load - age bonus
     (escalated cases get a huge bonus so they are planned first) and the best feasible pair is taken,
     until nothing more fits (time budget, daily per-category ceilings);
  3. each route is put in its optimal order (exact Held-Karp up to 10 stops, 2-opt beyond);
  4. cases are moved between routes when that saves travel; freed time is refilled.
Cases that do not fit roll to the next working day.

ONE CHANGE from the project engine (AC_Scheduler_Python/ac_scheduler/engine.py): travel times are rounded to
9 decimals by snap(). The maths library differs in the last digit between operating systems, and an exact tie
between two stop orders was decided by that noise, so the same input gave different plans on Windows and
Linux. With snap() every machine sees the same numbers. All other code is unchanged.

STEP 2 (generalisation, docs/superpowers/specs/2026-11-20-engine-step-2-design.md): work types and skills as free
lists, a start and an end place per technician, working hours per technician, priority levels, soft due dates and
visit time by product. Every new field is optional; for an input that uses none of them the plan is identical.
"""
from __future__ import annotations

import datetime as dt
import math
from dataclasses import dataclass, field

CAT_NAMES = ["Installation", "Service / RMS", "Breakdown"]
CAT_SHORT = ["Installation", "Service", "Breakdown"]


@dataclass
class Cfg:
    store_lat: float = 8.5241
    store_lon: float = 76.9366
    speed: float = 30.0
    road_factor: float = 1.35
    hop_min: float = 10.0
    usable_min: float = 480.0
    age_w: float = 4.0
    bal_w: float = 0.05
    max_km: float = 60.0
    start_min: float = 540.0
    lunch_min: float = 780.0
    break_min: float = 60.0
    svc_min: list = field(default_factory=lambda: [120.0, 75.0, 75.0])
    target: list = field(default_factory=lambda: [3.0, 5.0, 5.0])
    horizon: int = 30
    sundays: bool = False
    start: dt.date = field(default_factory=dt.date.today)
    holidays: set = field(default_factory=set)
    cat_names: list = field(default_factory=lambda: list(CAT_NAMES))
    req_skill: list = field(default_factory=lambda: [0, 1, 2])


@dataclass
class CaseIn:
    id: str
    cat: int                     # 0 Installation, 1 Service, 2 Breakdown
    area: int                    # index into the areas list
    esc: bool = False
    reported: dt.date = field(default_factory=dt.date.today)
    req_tech: int = -1           # manual technician index or -1
    man_date: dt.date | None = None
    freeze_tech: int = -1
    subject: str = ""


@dataclass
class TechIn:
    name: str
    skill: list = field(default_factory=lambda: [False, False, False])
    active: bool = True
    leave_from: dt.date | None = None
    leave_to: dt.date | None = None


class Route:
    __slots__ = ("stops", "travel", "service", "frac", "pinned", "ver")

    def __init__(self):
        self.stops: list[int] = []
        self.travel = 0.0
        self.service = 0.0
        self.frac = 0.0
        self.pinned = False
        self.ver = 0


class Result:
    def __init__(self):
        self.date: dict[int, dt.date] = {}
        self.tech: dict[int, int] = {}
        self.visit: dict[int, int] = {}
        self.why: dict[int, str] = {}
        self.prev_km: dict[int, float] = {}
        self.travel_min: dict[int, float] = {}
        self.eta: dict[int, str] = {}
        self.flag: dict[int, str] = {}
        self.days: list[dt.date] = []
        self.routes: dict[dt.date, dict[int, Route]] = {}
        self.unscheduled: set[int] = set()
        self.unsched_reason: dict[int, str] = {}


def haversine_km(la1, lo1, la2, lo2):
    r, p = 6371.0, math.pi / 180.0
    d_la, d_lo = (la2 - la1) * p, (lo2 - lo1) * p
    a = math.sin(d_la / 2) ** 2 + math.cos(la1 * p) * math.cos(la2 * p) * math.sin(d_lo / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def snap(minutes: float) -> float:
    """Rounds travel minutes to 9 decimals. Only multiply, add, floor and divide, which are exact everywhere
    (the web engine does the same four steps in snapMinutes)."""
    return math.floor(minutes * 1e9 + 0.5) / 1e9


def hm(minutes: float) -> str:
    t = int(round(minutes))
    return "%02d:%02d" % ((t // 60) % 24, t % 60)


class Engine:
    def __init__(self, cfg: Cfg, cases: list, techs: list, area_name: list, lat: list, lon: list):
        self.C, self.cases, self.techs = cfg, cases, techs
        self.area_name, self.lat, self.lon = area_name, lat, lon
        n = len(area_name) + 1
        la = [cfg.store_lat] + list(lat)
        lo = [cfg.store_lon] + list(lon)
        self.tm = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if i == j:
                    self.tm[i][j] = 0.0 if i == 0 else cfg.hop_min
                else:
                    self.tm[i][j] = max(cfg.hop_min * 0.5,
                                        snap(haversine_km(la[i], lo[i], la[j], lo[j]) * cfg.road_factor / cfg.speed * 60.0))
        self.zone: list[str] = []
        self.area_km: list[float] = []
        octants = ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"]
        for i in range(len(area_name)):
            km = haversine_km(la[0], lo[0], la[i + 1], lo[i + 1])
            dy = la[i + 1] - la[0]
            dx = (lo[i + 1] - lo[0]) * math.cos(la[0] * math.pi / 180.0)
            ang = math.degrees(math.atan2(dx, dy))
            if ang < 0:
                ang += 360
            self.area_km.append(km)
            self.zone.append("Central" if km < 4 else octants[int(round(ang / 45.0)) % 8])

    # ---- helpers ----
    def node(self, c):
        return self.cases[c].area + 1

    def travel_of(self, stops):
        if not stops:
            return 0.0
        t, prev = 0.0, 0
        for c in stops:
            nd = self.node(c)
            t += self.tm[prev][nd]
            prev = nd
        return t + self.tm[prev][0]

    def is_workday(self, d):
        if d.weekday() == 6 and not self.C.sundays:
            return False
        return d not in self.C.holidays

    def available(self, t, d):
        T = self.techs[t]
        if not T.active:
            return False
        if T.leave_from and d >= T.leave_from and (T.leave_to is None or d <= T.leave_to):
            return False
        return True

    def best_insert(self, r: Route, c):
        delta, pos, n, cn = float("inf"), 0, len(r.stops), self.node(c)
        tm = self.tm
        for p in range(n + 1):
            prev = 0 if p == 0 else self.node(r.stops[p - 1])
            nxt = 0 if p == n else self.node(r.stops[p])
            d = tm[prev][cn] + tm[cn][nxt] - tm[prev][nxt]
            if d < delta:
                delta, pos = d, p
        return delta, pos

    def fits(self, r: Route, c, delta):
        cat = self.cases[c].cat
        if r.travel + delta + r.service + self.C.svc_min[cat] > self.C.usable_min + 1e-6:
            return False
        if r.frac + 1.0 / self.C.target[cat] > 1.0 + 1e-6:
            return False
        return True

    def recalc(self, r: Route):
        r.ver += 1
        r.travel = self.travel_of(r.stops)
        r.service = 0.0
        r.frac = 0.0
        for c in r.stops:
            cat = self.cases[c].cat
            r.service += self.C.svc_min[cat]
            r.frac += 1.0 / self.C.target[cat]

    def order(self, r: Route):
        n = len(r.stops)
        if n < 2:
            self.recalc(r)
            return
        tm = self.tm
        if n <= 10:
            nodes = [self.node(c) for c in r.stops]
            inf = float("inf")
            full = 1 << n
            dp = [[inf] * n for _ in range(full)]
            par = [[-1] * n for _ in range(full)]
            for j in range(n):
                dp[1 << j][j] = tm[0][nodes[j]]
            for m in range(1, full):
                row = dp[m]
                for j in range(n):
                    if not (m >> j) & 1 or row[j] == inf:
                        continue
                    dj = row[j]
                    for k in range(n):
                        if (m >> k) & 1:
                            continue
                        nm = m | (1 << k)
                        v = dj + tm[nodes[j]][nodes[k]]
                        if v < dp[nm][k]:
                            dp[nm][k] = v
                            par[nm][k] = j
            best, bj = inf, 0
            for j in range(n):
                v = dp[full - 1][j] + tm[nodes[j]][0]
                if v < best:
                    best, bj = v, j
            seq, mask, cur = [], full - 1, bj
            while cur != -1:
                seq.append(r.stops[cur])
                p = par[mask][cur]
                mask &= ~(1 << cur)
                cur = p
            seq.reverse()
            r.stops = seq
        else:
            imp, guard = True, 0
            while imp and guard < 200:
                guard += 1
                imp = False
                cur = self.travel_of(r.stops)
                for i in range(n - 1):
                    if imp:
                        break
                    for j in range(i + 1, n):
                        t = list(r.stops)
                        t[i:j + 1] = reversed(t[i:j + 1])
                        v = self.travel_of(t)
                        if v < cur - 1e-6:
                            r.stops = t
                            imp = True
                            break
        self.recalc(r)

    def can_do(self, t, c):
        need = self.C.req_skill[self.cases[c].cat]
        have = self.techs[t].skill
        return need < len(have) and have[need]

    # ---- planning ----
    def plan(self) -> Result:
        res = Result()
        C = self.C
        left = list(range(len(self.cases)))
        eligible: dict[int, list[int]] = {}
        for c in range(len(self.cases)):
            l = [t for t in range(len(self.techs)) if self.techs[t].active and self.can_do(t, c)]
            if self.cases[c].req_tech >= 0:
                l = [x for x in l if x == self.cases[c].req_tech]
            eligible[c] = l
            if not l:
                left.remove(c)
                res.unscheduled.add(c)
                res.unsched_reason[c] = ("Manual technician is not approved for this work type"
                                         if self.cases[c].req_tech >= 0 else "No active technician has this skill")
        day, worked, guard = C.start, 0, 0
        while left and worked < C.horizon and guard < 2000:
            guard += 1
            if not self.is_workday(day):
                day += dt.timedelta(days=1)
                continue
            worked += 1
            routes: dict[int, Route] = {t: Route() for t in range(len(self.techs)) if self.available(t, day)}
            pool = [c for c in left if not (self.cases[c].man_date and self.cases[c].man_date > day)]
            for c in list(pool):
                cs = self.cases[c]
                pt = -1
                if cs.req_tech >= 0 and cs.man_date and cs.man_date == day:
                    pt = cs.req_tech
                elif cs.freeze_tech >= 0 and day == C.start:
                    pt = cs.freeze_tech
                if pt < 0 or pt not in routes or not self.can_do(pt, c):
                    continue
                d, p = self.best_insert(routes[pt], c)
                routes[pt].stops.insert(p, c)
                self.recalc(routes[pt])
                routes[pt].pinned = True
                pool.remove(c)
                left.remove(c)
                res.why[c] = "Manual assignment" if (cs.req_tech >= 0 and cs.man_date) else "Kept from earlier plan (frozen)"
                res.tech[c] = pt
                res.date[c] = day
            for _ in range(3):
                self.greedy(routes, pool, left, eligible, day)
                for r in routes.values():
                    self.order(r)
                self.relocate(routes, eligible)
            self.greedy(routes, pool, left, eligible, day)
            for r in routes.values():
                self.order(r)
            res.days.append(day)
            res.routes[day] = routes
            for t, r in routes.items():
                for c in r.stops:
                    res.date[c] = day
                    res.tech[c] = t
            day += dt.timedelta(days=1)
        for c in left:
            res.unscheduled.add(c)
            res.unsched_reason.setdefault(
                c, "Beyond planning horizon (%d working days) or does not fit in a day" % C.horizon)
        self.finalise(res)
        return res

    def greedy(self, routes, pool, left, eligible, day):
        C = self.C
        cache: dict = {}
        while True:
            best_score, bc, bt, bp = float("inf"), -1, -1, 0
            for c in pool:
                cs = self.cases[c]
                age = min(90.0, max(0.0, float((day - cs.reported).days)))
                bonus = age * C.age_w + (100000.0 if cs.esc else 0.0)
                for t in eligible[c]:
                    r = routes.get(t)
                    if r is None:
                        continue
                    key = (c, t)
                    ent = cache.get(key)
                    if ent is None or ent[0] != r.ver:
                        d, p = self.best_insert(r, c)
                        ent = (r.ver, d, p)
                        cache[key] = ent
                    d, p = ent[1], ent[2]
                    if not self.fits(r, c, d):
                        continue
                    score = d + C.bal_w * (r.travel + r.service) - bonus
                    if score < best_score:
                        best_score, bc, bt, bp = score, c, t, p
            if bc < 0:
                break
            rr = routes[bt]
            rr.stops.insert(bp, bc)
            self.recalc(rr)
            pool.remove(bc)
            left.remove(bc)

    def relocate(self, routes, eligible):
        for _ in range(20):
            best_gain, bc, frm, to, bp = 0.5, -1, -1, -1, 0
            for k, r in routes.items():
                if r.pinned:
                    continue
                for c in r.stops:
                    without = [x for x in r.stops if x != c]
                    saved = r.travel - self.travel_of(without)
                    for t in eligible[c]:
                        if t == k or t not in routes or routes[t].pinned:
                            continue
                        d, p = self.best_insert(routes[t], c)
                        if not self.fits(routes[t], c, d):
                            continue
                        gain = saved - d
                        if gain > best_gain:
                            best_gain, bc, frm, to, bp = gain, c, k, t, p
            if bc < 0:
                return
            routes[frm].stops.remove(bc)
            self.recalc(routes[frm])
            routes[to].stops.insert(bp, bc)
            self.recalc(routes[to])
            self.order(routes[frm])
            self.order(routes[to])

    def finalise(self, res: Result):
        C = self.C
        for day in res.days:
            for t, r in res.routes[day].items():
                self.recalc(r)
                clock, brk, prev = C.start_min, False, 0
                if r.travel + r.service > C.usable_min + 1e-6:
                    for c in r.stops:
                        res.flag[c] = "OVER CAPACITY"
                for i, c in enumerate(r.stops):
                    nxt = self.node(r.stops[i + 1]) if i + 1 < len(r.stops) else 0
                    tmin = self.tm[prev][self.node(c)]
                    clock += tmin
                    if not brk and clock >= C.lunch_min:
                        clock += C.break_min
                        brk = True
                    res.eta[c] = hm(clock)
                    res.travel_min[c] = tmin
                    res.visit[c] = i + 1
                    clock += C.svc_min[self.cases[c].cat]
                    prev = self.node(c)
                    pn = 0 if i == 0 else self.node(r.stops[i - 1])
                    detour = self.tm[pn][self.node(c)] + self.tm[self.node(c)][nxt] - self.tm[pn][nxt]
                    if c not in res.why:
                        res.why[c] = "Skill match (%s approved for %s); %s; route of %d stop%s in %s" % (
                            self.techs[t].name, C.cat_names[self.cases[c].cat],
                            "no extra travel" if detour < 1 else "adds %d min detour" % int(round(detour)),
                            len(r.stops), "s" if len(r.stops) > 1 else "", self.zone[self.cases[c].area])
        for day in res.days:
            for t, r in res.routes[day].items():
                prev_area = -1
                for c in r.stops:
                    a = self.cases[c].area
                    if prev_area < 0:
                        km = self.area_km[a] * C.road_factor
                    elif prev_area == a:
                        km = 0.0
                    else:
                        km = haversine_km(self.lat[prev_area], self.lon[prev_area], self.lat[a], self.lon[a]) * C.road_factor
                    res.prev_km[c] = km
                    prev_area = a
