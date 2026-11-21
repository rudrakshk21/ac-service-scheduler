import { dayNumber, weekday } from '../../engine/calendar'
import type { PlanInput } from '../../engine/types'
import { toPlanInput } from '../../intake/import/plan-input'
import type { Workspace } from '../../workspace/workspace'

const isoOf = (day: number): string => new Date(day * 86_400_000).toISOString().slice(0, 10)

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

/** What the plan tab needs: the engine's input and which cases are left out, or one plain reason why it cannot plan yet. */
export function prepare(w: Workspace, today: string): Prepared {
  if (w.technicians.length === 0) {
    return blocked('Import your technicians', 'The plan needs to know who can do the visits. Import a file of technicians, or add them in Set-up.', 'Import technicians', '#/import')
  }
  if (w.cases.length === 0) {
    return blocked('Import your cases', 'Import a file of service cases and they will be planned here.', 'Import cases', '#/import')
  }
  const ready = w.cases.filter((c) => c.state === 'active')
  if (ready.length === 0) {
    const n = (s: string) => w.cases.filter((c) => c.state === s).length
    return blocked(
      'Nothing is ready to plan',
      `${n('hold')} on hold, ${n('review')} in review, ${n('ignored')} ignored, ${n('done')} done, ${n('closed')} closed. Only cases that are ready to plan are planned.`,
      'See the data', '#/data',
    )
  }
  if (!w.technicians.some((t) => t.active)) {
    return blocked('Switch a technician on', 'Every technician is switched off, so nobody can take a visit.', 'Open set-up', '#/setup')
  }
  const planStart = startDate(today, w.site.settings.restWeekdays, w.holidays)
  const { input, caseIds } = toPlanInput(w.site, w.cases, w.technicians, { planStart, holidays: w.holidays, importDate: today })
  if (caseIds.length === 0) {
    return blocked(
      'No case can be planned yet',
      'The ready cases have no place or work type that the planner knows. Fix the problems listed in the Data tab.',
      'See the problems', '#/data',
    )
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
