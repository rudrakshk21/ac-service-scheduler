import type { PlanResult } from '../types'

const EPS = 1e-9

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b))
}

/** Lists the differences between a computed and an expected result (at most 25). An empty list means identical. */
export function compareResults(actual: PlanResult, expected: PlanResult): string[] {
  const out: string[] = []
  const add = (msg: string): void => {
    if (out.length < 25) out.push(msg)
  }
  if (actual.scheduled.length !== expected.scheduled.length) {
    add(`scheduled count ${actual.scheduled.length} != ${expected.scheduled.length}`)
  }
  const n = Math.min(actual.scheduled.length, expected.scheduled.length)
  for (let i = 0; i < n; i++) {
    const a = actual.scheduled[i]
    const e = expected.scheduled[i]
    for (const key of ['id', 'day', 'tech', 'visit', 'eta', 'why', 'flag'] as const) {
      if (a[key] !== e[key]) add(`case ${e.id}: ${key} ${JSON.stringify(a[key])} != ${JSON.stringify(e[key])}`)
    }
    for (const key of ['travelMin', 'prevKm'] as const) {
      if (!close(a[key], e[key])) add(`case ${e.id}: ${key} ${a[key]} != ${e[key]}`)
    }
  }
  if (JSON.stringify(actual.unscheduled) !== JSON.stringify(expected.unscheduled)) {
    add(`unscheduled ${JSON.stringify(actual.unscheduled)} != ${JSON.stringify(expected.unscheduled)}`)
  }
  if (JSON.stringify(actual.days) !== JSON.stringify(expected.days)) {
    add(`days ${JSON.stringify(actual.days)} != ${JSON.stringify(expected.days)}`)
  }
  if (actual.routes.length !== expected.routes.length) {
    add(`route count ${actual.routes.length} != ${expected.routes.length}`)
  }
  const m = Math.min(actual.routes.length, expected.routes.length)
  for (let i = 0; i < m; i++) {
    const a = actual.routes[i]
    const e = expected.routes[i]
    const where = `route day ${e.day} technician ${e.tech}`
    if (a.day !== e.day || a.tech !== e.tech) add(`${where}: found day ${a.day} technician ${a.tech}`)
    if (JSON.stringify(a.stops) !== JSON.stringify(e.stops)) {
      add(`${where}: stops ${JSON.stringify(a.stops)} != ${JSON.stringify(e.stops)}`)
    }
    for (const key of ['travelMin', 'serviceMin', 'load'] as const) {
      if (!close(a[key], e[key])) add(`${where}: ${key} ${a[key]} != ${e[key]}`)
    }
  }
  return out
}
