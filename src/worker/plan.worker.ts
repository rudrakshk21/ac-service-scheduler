import type { PlanInput } from '../engine'
import { handlePlanRequest } from './handler'

// The worker scope; typed by hand because this project's TypeScript config uses the DOM library.
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<PlanInput>) => void) | null
  postMessage: (message: unknown) => void
}

scope.onmessage = (e) => {
  scope.postMessage(handlePlanRequest(e.data))
}
