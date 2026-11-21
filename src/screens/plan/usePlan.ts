import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type { PlanInput, PlanResult } from '../../engine'
import { movedCases } from '../../demo/viewModel'
import type { ChangeNote } from '../../demo/useDemoPlan'
import { startPlan, type PlanJob } from '../../worker/client'

export interface SwitchNote {
  techName: string
  switchedOn: boolean
}

export interface PlanState {
  /** The input that `result` was planned from. Use this, not the newest input, to draw the board. */
  input: PlanInput | null
  result: PlanResult | null
  /** The newest input has not been planned yet. */
  busy: boolean
  error: string | null
  change: ChangeNote | null
}

interface Settled {
  /** Content key of the input this answer is for. */
  key: string
  input: PlanInput | null
  result: PlanResult | null
  error: string | null
  change: ChangeNote | null
}

const idle: PlanState = { input: null, result: null, busy: false, error: null, change: null }

/**
 * The last plan that was made, kept while the page lives. A plan depends on nothing but its input, so coming back to
 * the screen with nothing changed shows it at once instead of planning again (seconds, on a phone, for a big centre).
 */
let lastPlan: { key: string; input: PlanInput; result: PlanResult } | null = null

/**
 * Plans an input in a worker and plans again whenever its content changes. A newer request replaces an older one.
 * `noteRef` holds who was just switched on or off; when it is set, the new plan comes with a note of what moved.
 */
export function usePlan(input: PlanInput | null, noteRef: MutableRefObject<SwitchNote | null>): PlanState {
  const key = useMemo(() => (input === null ? '' : JSON.stringify(input)), [input])
  const kept = lastPlan !== null && lastPlan.key === key ? lastPlan : null
  const [settled, setSettled] = useState<Settled>({ key: '', input: null, result: null, error: null, change: null })
  const lastKey = useRef(kept === null ? '' : key)
  const previous = useRef<PlanResult | null>(kept === null ? null : kept.result)
  const ticket = useRef(0)
  const changes = useRef(0)
  const job = useRef<PlanJob | null>(null)

  const run = useCallback((next: PlanInput, forKey: string) => {
    const mine = ++ticket.current
    const note = noteRef.current
    noteRef.current = null
    // The plan this one replaces is of no use any more: stop it instead of letting it run to the end.
    job.current?.cancel()
    job.current = startPlan(next)
    job.current.result.then(
      (result) => {
        if (mine !== ticket.current) return
        const before = previous.current
        previous.current = result
        lastPlan = { key: forKey, input: next, result }
        const change = before !== null && note !== null ? { ...movedCases(before, result), ...note, id: ++changes.current } : null
        setSettled({ key: forKey, input: next, result, error: null, change })
      },
      (e: unknown) => {
        if (mine !== ticket.current) return
        setSettled((s) => ({ ...s, key: forKey, error: e instanceof Error ? e.message : String(e), change: null }))
      },
    )
  }, [noteRef])

  useEffect(() => {
    if (key === lastKey.current) return
    lastKey.current = key
    if (input === null) {
      ticket.current += 1
      job.current?.cancel()
      job.current = null
      previous.current = null
      return
    }
    if (lastPlan !== null && lastPlan.key === key) {
      // Nothing to plan: the render below already shows the kept plan.
      previous.current = lastPlan.result
      return
    }
    run(input, key)
  }, [input, key, run])

  // Leaving the screen stops the plan in progress. `lastKey` is cleared so that the screen, shown again, looks again.
  useEffect(
    () => () => {
      ticket.current += 1
      job.current?.cancel()
      job.current = null
      lastKey.current = ''
    },
    [],
  )

  if (input === null) return idle
  if (settled.key !== key && kept !== null) return { input: kept.input, result: kept.result, busy: false, error: null, change: null }
  return { input: settled.input, result: settled.result, busy: settled.key !== key, error: settled.error, change: settled.change }
}
