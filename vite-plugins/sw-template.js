/* Service worker of AC Service Scheduler.
   vite-plugins/precache.ts fills in VERSION and FILES when the app is built and writes the result to dist/sw.js.
   Nothing here talks to the network except to fetch a file that was not stored. */
const VERSION = '__VERSION__'
const FILES = __FILES__
const PREFIX = 'ac-scheduler-'
const CACHE = PREFIX + VERSION

self.addEventListener('install', (event) => {
  // No skipWaiting here: a new version waits until the person chooses to reload, so an import in progress is not lost.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith(PREFIX) && name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  event.respondWith(answer(request))
})

// One copy of each file is stored, so the headers a server names in Vary do not matter. Without ignoreVary a script
// that the page loads with an Origin header (every module script does) would not find the copy stored without one.
const LOOK = { ignoreSearch: true, ignoreVary: true }

async function answer(request) {
  const cache = await caches.open(CACHE)
  const stored = await cache.match(request, LOOK)
  if (stored !== undefined) return stored
  // A page address the app does not have as a file (a reload on any screen) still opens the app.
  if (request.mode === 'navigate') {
    const page = await cache.match('/index.html', LOOK)
    if (page !== undefined) return page
  }
  return fetch(request)
}
