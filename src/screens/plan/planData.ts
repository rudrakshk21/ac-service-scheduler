import { dayNumber, weekday } from '../../engine/calendar'
import { haversineKm } from '../../engine/geo'
import type { PlanInput } from '../../engine/types'
import { toPlanInput } from '../../intake/import/plan-input'
import { t } from '../../i18n'
import { isoOf } from '../../share/dates'
import type { Workspace } from '../../workspace/workspace'

/** The first day on or after `today` that is not a rest day or a holiday. `YYYY-MM-DD`. */
export function startDate(today: string, restWeekdays: number[], holidays: string[]): string {
  let day = dayNumber(today)
  const off = new Set(holidays.map(dayNumber))
  for (let guard = 0; guard < 400; guard++) {
    if (!restWeekdays.includes(weekday(day)) && !off.has(day)) break
    day += 1
  }
  return isoOf(day)
}

export type Prepared =
  | { ok: true; input: PlanInput; caseIds: string[]; planStart: string; left: { hold: number; review: number; noPlace: number } }
  | { ok: false; title: string; text: string; action: { label: string; href: string } }

const blocked = (title: string, text: string, label: string, href: string): Prepared => ({ ok: false, title, text, action: { label, href } })

export interface BaseAdvice {
  /** The middle of the places the ready cases are in, 4 decimals. */
  lat: number
  lon: number
  /** Straight-line distance from the current base to the nearest of those places. */
  nearestKm: number
}

const round4 = (n: number): number => Math.round(n * 10_000) / 10_000

/**
 * A new centre starts with a placeholder base far from anywhere. When no ready case is within a day's round trip of the
 * base, the plan is empty for a reason the engine can only call "does not fit in a day": suggest the middle of the cases.
 * Not offered when every active technician has a start and end place of their own (the base does not matter then).
 */
export function baseAdvice(w: Workspace): BaseAdvice | null {
  const used = new Set(w.cases.filter((c) => c.state === 'active' && c.place !== undefined).map((c) => c.place))
  const spots = w.site.places.filter((p) => used.has(p.name))
  if (spots.length === 0) return null
  const active = w.technicians.filter((t) => t.active)
  if (active.length > 0 && active.every((t) => t.startPlace !== undefined && t.endPlace !== undefined)) return null
  const s = w.site.settings
  const nearestKm = Math.min(...spots.map((p) => haversineKm(s.baseLat, s.baseLon, p.latitude, p.longitude)))
  const oneWayMin = ((nearestKm * s.roadFactor) / s.speedKmh) * 60
  if (oneWayMin * 2 <= s.usableMin) return null
  return {
    lat: round4(spots.reduce((sum, p) => sum + p.latitude, 0) / spots.length),
    lon: round4(spots.reduce((sum, p) => sum + p.longitude, 0) / spots.length),
    nearestKm: Math.round(nearestKm),
  }
}

/** One sentence for the top of the plan when not a single case could be planned. */
export function nothingPlannedHint(input: PlanInput): string {
  const active = input.technicians.filter((t) => t.active)
  if (active.length > 0 && active.every((t) => t.skills.length === 0)) {
    return t('plan.hint.skills')
  }
  return t('plan.hint.generic')
}

/** What the plan tab needs: the engine's input and which cases are left out, or one plain reason why it cannot plan yet. */
export function prepare(w: Workspace, today: string): Prepared {
  if (w.technicians.length === 0) {
    return blocked(t('plan.blocked.noTech.title'), t('plan.blocked.noTech.text'), t('plan.blocked.noTech.action'), '#/import')
  }
  if (w.cases.length === 0) {
    return blocked(t('plan.blocked.noCases.title'), t('plan.blocked.noCases.text'), t('plan.blocked.noCases.action'), '#/import')
  }
  const ready = w.cases.filter((c) => c.state === 'active')
  if (ready.length === 0) {
    const n = (s: string) => w.cases.filter((c) => c.state === s).length
    return blocked(
      t('plan.blocked.nothing.title'),
      t('plan.blocked.nothing.text', { hold: n('hold'), review: n('review'), ignored: n('ignored'), done: n('done'), closed: n('closed') }),
      t('plan.seeData'), '#/data',
    )
  }
  if (!w.technicians.some((x) => x.active)) {
    return blocked(t('plan.blocked.allOff.title'), t('plan.blocked.allOff.text'), t('plan.openSetup'), '#/setup')
  }
  const planStart = startDate(today, w.site.settings.restWeekdays, w.holidays)
  const { input, caseIds } = toPlanInput(w.site, w.cases, w.technicians, { planStart, holidays: w.holidays, importDate: today })
  if (caseIds.length === 0) {
    return blocked(t('plan.blocked.unplannable.title'), t('plan.blocked.unplannable.text'), t('plan.blocked.unplannable.action'), '#/data')
  }
  return {
    ok: true, input, caseIds, planStart,
    left: {
      hold: w.cases.filter((c) => c.state === 'hold').length,
      review: w.cases.filter((c) => c.state === 'review').length,
      noPlace: ready.length - caseIds.length,
    },
  }
}
