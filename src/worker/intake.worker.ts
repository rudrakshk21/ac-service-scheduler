import { handleIntakeRequest, type IntakeRequest } from './intakeHandler'

// The worker scope; typed by hand because this project's TypeScript config uses the DOM library.
const scope = self as unknown as {
  onmessage: ((e: MessageEvent<IntakeRequest>) => void) | null
  postMessage: (message: unknown) => void
}

scope.onmessage = (e) => {
  void handleIntakeRequest(e.data).then((reply) => scope.postMessage(reply))
}
