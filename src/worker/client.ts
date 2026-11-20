import type { PlanInput, PlanResult } from '../engine'
import type { PlanReply } from './handler'

/** Plans in a Web Worker so that the screen stays responsive. Rejects with the engine's plain message on invalid input. */
export function planInWorker(input: PlanInput): Promise<PlanResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./plan.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<PlanReply>) => {
      worker.terminate()
      if (e.data.ok) resolve(e.data.result)
      else reject(new Error(e.data.error))
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message))
    }
    worker.postMessage(input)
  })
}
