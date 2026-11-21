/**
 * Registers the service worker and tells the screens when an update is waiting or the app can be installed.
 * Browser code: checked in the browser, not in Node. The worker itself is tested in `vite-plugins/sw.test.ts`.
 */

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
}

export interface PwaState {
  /** A newer version of the app is downloaded and waits for the person to reload. */
  updateReady: boolean
  /** The browser offers to install the app. */
  canInstall: boolean
}

let state: PwaState = { updateReady: false, canInstall: false }
let waiting: ServiceWorker | null = null
let installEvent: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

function set(change: Partial<PwaState>): void {
  state = { ...state, ...change }
  listeners.forEach((listener) => listener())
}

/** For `useSyncExternalStore`. */
export const pwaStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  getSnapshot(): PwaState {
    return state
  },
}

function watch(registration: ServiceWorkerRegistration): void {
  // Only a worker that arrives while the page is already controlled is an update; the first install is not.
  const ready = (worker: ServiceWorker | null): void => {
    if (worker !== null && navigator.serviceWorker.controller !== null) {
      waiting = worker
      set({ updateReady: true })
    }
  }
  ready(registration.waiting)
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed') ready(worker)
    })
  })
}

/** Called once at start. Does nothing in development or in a browser without service workers. */
export function startPwa(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then(watch, () => undefined)
  })
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installEvent = event as InstallPromptEvent
    set({ canInstall: true })
  })
  window.addEventListener('appinstalled', () => {
    installEvent = null
    set({ canInstall: false })
  })
}

/** Switches to the waiting version and reloads the page once it has taken over. */
export function applyUpdate(): void {
  if (waiting === null) return
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
  waiting.postMessage('skip-waiting')
}

/** Shows the browser's install question. */
export async function promptInstall(): Promise<void> {
  const event = installEvent
  if (event === null) return
  installEvent = null
  set({ canInstall: false })
  await event.prompt()
}
