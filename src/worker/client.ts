import type { PlanInput, PlanResult } from '../engine'
import type { PlanReply } from './handler'

/** A plan being worked out in a worker. */
export interface PlanJob {
  /** The plan. Rejects with the engine's plain message on invalid input, and with `PlanCancelled` after `cancel()`. */
  result: Promise<PlanResult>
  /** Stops the work now, so that an answer nobody waits for does not keep a phone busy. */
  cancel: () => void
}

/** What a job's `result` rejects with after `cancel()`. */
export class PlanCancelled extends Error {
  constructor() {
    super('The plan was stopped.')
    this.name = 'PlanCancelled'
  }
}

/** Plans in a Web Worker so that the screen stays responsive. */
export function startPlan(input: PlanInput): PlanJob {
  const worker = new Worker(new URL('./plan.worker.ts', import.meta.url), { type: 'module' })
  let cancel: () => void = () => {}
  const result = new Promise<PlanResult>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<PlanReply>) => {
      worker.terminate()
      if (e.data.ok) resolve(e.data.result)
      else reject(new Error(e.data.error))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message))
    }
    cancel = () => {
      worker.terminate()
      reject(new PlanCancelled())
    }
    worker.postMessage(input)
  })
  return { result, cancel: () => cancel() }
}

/** Plans in a Web Worker and waits for the answer. Rejects with the engine's plain message on invalid input. */
export function planInWorker(input: PlanInput): Promise<PlanResult> {
  return startPlan(input).result
}
