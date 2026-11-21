import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlanInput, PlanResult } from '../engine'
import { startPlan, type PlanJob } from '../worker/client'
import { movedCases, type Change } from './viewModel'

export interface ChangeNote extends Change {
  /** Increases with every re-plan, so that the page can restart its highlight. */
  id: number
  techName: string
  switchedOn: boolean
}

export interface DemoPlan {
  input: PlanInput | null
  result: PlanResult | null
  change: ChangeNote | null
  busy: boolean
  error: string | null
  toggleTechnician: (tech: number) => void
}

interface Planned {
  input: PlanInput
  result: PlanResult
}

/** Plans the invented demo data in a worker, and re-plans whenever a technician is switched on or off. */
export function useDemoPlan(): DemoPlan {
  const [planned, setPlanned] = useState<Planned | null>(null)
  const [change, setChange] = useState<ChangeNote | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const current = useRef<Planned | null>(null)
  const ticket = useRef(0)
  const changes = useRef(0)
  const job = useRef<PlanJob | null>(null)

  const replan = useCallback((next: PlanInput, note: { techName: string; switchedOn: boolean } | null) => {
    const mine = ++ticket.current
    setBusy(true)
    job.current?.cancel()
    job.current = startPlan(next)
    job.current.result.then(
      (result) => {
        if (mine !== ticket.current) return // a newer request replaced this one
        const previous = current.current
        current.current = { input: next, result }
        setPlanned(current.current)
        setError(null)
        setBusy(false)
        setChange(previous && note ? { ...movedCases(previous.result, result), ...note, id: ++changes.current } : null)
      },
      (e: unknown) => {
        if (mine !== ticket.current) return
        setError(e instanceof Error ? e.message : String(e))
        setBusy(false)
      },
    )
  }, [])

  useEffect(() => {
    let live = true
    void import('./demoInput').then((m) => {
      if (live) replan(m.demoInput, null)
    })
    return () => {
      live = false
      ticket.current += 1
      job.current?.cancel()
      job.current = null
    }
  }, [replan])

  const toggleTechnician = useCallback(
    (tech: number) => {
      const base = current.current
      if (base === null) return
      const technicians = base.input.technicians.map((t, i) => (i === tech ? { ...t, active: !t.active } : t))
      const t = technicians[tech]
      replan({ ...base.input, technicians }, { techName: t.name, switchedOn: t.active })
    },
    [replan],
  )

  return { input: planned?.input ?? null, result: planned?.result ?? null, change, busy, error, toggleTechnician }
}
