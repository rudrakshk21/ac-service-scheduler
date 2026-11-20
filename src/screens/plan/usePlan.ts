import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type { PlanInput, PlanResult } from '../../engine'
import { movedCases } from '../../demo/viewModel'
import type { ChangeNote } from '../../demo/useDemoPlan'
import { planInWorker } from '../../worker/client'

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
 * Plans an input in a worker and plans again whenever its content changes. A newer request replaces an older one.
 * `noteRef` holds who was just switched on or off; when it is set, the new plan comes with a note of what moved.
 */
export function usePlan(input: PlanInput | null, noteRef: MutableRefObject<SwitchNote | null>): PlanState {
  const [settled, setSettled] = useState<Settled>({ key: '', input: null, result: null, error: null, change: null })
  const key = useMemo(() => (input === null ? '' : JSON.stringify(input)), [input])
  const lastKey = useRef('')
  const previous = useRef<PlanResult | null>(null)
  const ticket = useRef(0)
  const changes = useRef(0)

  const run = useCallback((next: PlanInput, forKey: string) => {
    const mine = ++ticket.current
    const note = noteRef.current
    noteRef.current = null
    planInWorker(next).then(
      (result) => {
        if (mine !== ticket.current) return
        const before = previous.current
        previous.current = result
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
      previous.current = null
      return
    }
    run(input, key)
  }, [input, key, run])

  if (input === null) return idle
  return { input: settled.input, result: settled.result, busy: settled.key !== key, error: settled.error, change: settled.change }
}
