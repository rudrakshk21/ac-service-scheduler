import type { PlanInput } from './types'

function fail(path: string, problem: string): never {
  throw new Error(`Invalid planning input: ${path} ${problem}`)
}

function needNum(path: string, x: number, min?: number): void {
  if (!Number.isFinite(x)) fail(path, 'must be a finite number')
  if (min !== undefined && x < min) fail(path, `must be at least ${min}`)
}

function needPositive(path: string, x: number): void {
  if (!Number.isFinite(x)) fail(path, 'must be a finite number')
  if (x <= 0) fail(path, 'must be greater than 0')
}

function needRange(path: string, x: number, lo: number, hi: number): void {
  if (!Number.isFinite(x)) fail(path, 'must be a finite number')
  if (x < lo || x > hi) fail(path, `must be between ${lo} and ${hi}`)
}

function needInt(path: string, x: number, min: number, max?: number): void {
  if (!Number.isInteger(x)) fail(path, 'must be a whole number')
  if (x < min) fail(path, `must be at least ${min}`)
  if (max !== undefined && x > max) fail(path, `must be at most ${max}`)
}

function needBool(path: string, x: unknown): void {
  if (typeof x !== 'boolean') fail(path, 'must be true or false')
}

function needText(path: string, x: unknown): void {
  if (typeof x !== 'string' || x === '') fail(path, 'must be text')
}

/** Rejects invalid input with a plain message that names the field. Full import validation is a later piece. */
export function checkInput(input: PlanInput): void {
  const s = input.settings
  needRange('settings.baseLat', s.baseLat, -90, 90)
  needRange('settings.baseLon', s.baseLon, -180, 180)
  needPositive('settings.speedKmh', s.speedKmh)
  needPositive('settings.roadFactor', s.roadFactor)
  needNum('settings.sameAreaHopMin', s.sameAreaHopMin, 0)
  needNum('settings.usableMin', s.usableMin, 0)
  needNum('settings.dayStartMin', s.dayStartMin, 0)
  needNum('settings.lunchStartMin', s.lunchStartMin, 0)
  needNum('settings.breakMin', s.breakMin, 0)
  needNum('settings.ageWeight', s.ageWeight, 0)
  needNum('settings.balanceWeight', s.balanceWeight, 0)
  needNum('settings.maxKm', s.maxKm, 0)
  needInt('settings.horizonDays', s.horizonDays, 0)
  needInt('settings.startDay', s.startDay, -1_000_000)
  s.restWeekdays.forEach((d, i) => needInt(`settings.restWeekdays[${i}]`, d, 0, 6))
  s.holidays.forEach((d, i) => needInt(`settings.holidays[${i}]`, d, -1_000_000))

  if (input.workTypes.length === 0) fail('workTypes', 'must list at least one work type')
  input.workTypes.forEach((w, i) => {
    needText(`workTypes[${i}].name`, w.name)
    needNum(`workTypes[${i}].serviceMin`, w.serviceMin, 0)
    needPositive(`workTypes[${i}].dailyCeiling`, w.dailyCeiling)
    needInt(`workTypes[${i}].requiredSkill`, w.requiredSkill, 0)
  })

  input.places.forEach((p, i) => {
    needText(`places[${i}].name`, p.name)
    needRange(`places[${i}].lat`, p.lat, -90, 90)
    needRange(`places[${i}].lon`, p.lon, -180, 180)
  })

  input.technicians.forEach((t, i) => {
    needText(`technicians[${i}].name`, t.name)
    needBool(`technicians[${i}].active`, t.active)
    t.skills.forEach((k, j) => needInt(`technicians[${i}].skills[${j}]`, k, 0))
    if (t.leaveFrom !== undefined) needInt(`technicians[${i}].leaveFrom`, t.leaveFrom, -1_000_000)
    if (t.leaveTo !== undefined) needInt(`technicians[${i}].leaveTo`, t.leaveTo, -1_000_000)
    if (t.startPlace !== undefined) needInt(`technicians[${i}].startPlace`, t.startPlace, 0, input.places.length - 1)
    if (t.endPlace !== undefined) needInt(`technicians[${i}].endPlace`, t.endPlace, 0, input.places.length - 1)
    for (const [k, v] of [
      ['dayStartMin', t.dayStartMin],
      ['usableMin', t.usableMin],
      ['lunchStartMin', t.lunchStartMin],
      ['breakMin', t.breakMin],
    ] as const) {
      if (v !== undefined) needNum(`technicians[${i}].${k}`, v, 0)
    }
  })

  const seen = new Set<string>()
  input.cases.forEach((c, i) => {
    needText(`cases[${i}].id`, c.id)
    if (seen.has(c.id)) fail(`cases[${i}].id`, `"${c.id}" is used twice`)
    seen.add(c.id)
    needInt(`cases[${i}].workType`, c.workType, 0, input.workTypes.length - 1)
    needInt(`cases[${i}].place`, c.place, 0, input.places.length - 1)
    needBool(`cases[${i}].escalated`, c.escalated)
    needInt(`cases[${i}].reportedDay`, c.reportedDay, -1_000_000)
    if (c.pinnedTech !== undefined) needInt(`cases[${i}].pinnedTech`, c.pinnedTech, 0, input.technicians.length - 1)
    if (c.frozenTech !== undefined) needInt(`cases[${i}].frozenTech`, c.frozenTech, 0, input.technicians.length - 1)
    if (c.earliestDay !== undefined) needInt(`cases[${i}].earliestDay`, c.earliestDay, -1_000_000)
  })
}
