import { plan, type PlanInput, type PlanResult } from '../engine'

export type PlanReply = { ok: true; result: PlanResult } | { ok: false; error: string }

/** The work of the worker, as a plain function so that it can be tested without a browser. */
export function handlePlanRequest(input: PlanInput): PlanReply {
  try {
    return { ok: true, result: plan(input) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
