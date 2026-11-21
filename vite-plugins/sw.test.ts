import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { swSource } from './precache.ts'

const ORIGIN = 'https://app.example'
const FILES = ['/', '/index.html', '/assets/a.js']

interface Ev {
  waitUntil?: (p: Promise<unknown>) => void
  respondWith?: (p: Promise<Response> | Response) => void
  request?: { method: string; url: string; mode: string; headers?: { origin?: string } }
  data?: unknown
}
type Handler = (e: Ev) => void

/** Runs the real worker file against a stand-in for the browser's cache and network. */
function boot() {
  const handlers: Record<string, Handler> = {}
  const store = new Map<string, Map<string, Response>>()
  const network = vi.fn(async (r: { url: string }) => new Response('network ' + new URL(r.url).pathname))
  const skipWaiting = vi.fn()
  const claim = vi.fn(async () => undefined)
  const cacheApi = {
    async open(name: string) {
      if (!store.has(name)) store.set(name, new Map())
      const entries = store.get(name)!
      return {
        async addAll(urls: string[]) {
          // As a real server may answer: a file that varies by Origin.
          for (const u of urls) {
            const res = new Response('cached ' + u, { headers: { Vary: 'Origin' } })
            // Cloudflare answers /index.html with a redirect to /, and the stored copy remembers it.
            if (u === '/index.html') Object.defineProperty(res, 'redirected', { value: true })
            entries.set(new URL(u, ORIGIN).href, res)
          }
        },
        async match(req: { url: string; headers?: { origin?: string } } | string, opts?: { ignoreSearch?: boolean; ignoreVary?: boolean }) {
          const want = new URL(typeof req === 'string' ? req : req.url, ORIGIN)
          // The browser compares the headers named by Vary with those of the request the file was stored for (none had an Origin).
          const origin = typeof req === 'string' ? undefined : req.headers?.origin
          for (const [href, res] of entries) {
            const have = new URL(href)
            if (have.pathname !== want.pathname || (opts?.ignoreSearch !== true && have.search !== want.search)) continue
            if (opts?.ignoreVary !== true && res.headers.get('vary') === 'Origin' && origin !== undefined) continue
            const copy = res.clone()
            if (res.redirected) Object.defineProperty(copy, 'redirected', { value: true })
            return copy
          }
          return undefined
        },
      }
    },
    async keys() {
      return [...store.keys()]
    },
    async delete(name: string) {
      return store.delete(name)
    },
  }
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => { handlers[type] = fn },
    skipWaiting,
    clients: { claim },
  }
  const source = swSource(readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8'), 'v1', FILES)
  vm.runInNewContext(source, { self, caches: cacheApi, fetch: network, URL, Response, Promise })

  const run = async (type: string, ev: Ev = {}) => {
    let pending: Promise<unknown> = Promise.resolve()
    let answer: Promise<Response> | Response | undefined
    handlers[type]({ ...ev, waitUntil: (p) => { pending = p }, respondWith: (p) => { answer = p } })
    await pending
    return answer === undefined ? undefined : await answer
  }
  const get = (path: string, over: Partial<{ method: string; mode: string; headers: { origin?: string } }> = {}) => ({ method: 'GET', mode: 'no-cors', url: ORIGIN + path, ...over })
  return { run, store, network, skipWaiting, claim, get }
}

describe('service worker', () => {
  it('stores every listed file under a name that carries the version', async () => {
    const w = boot()
    await w.run('install')
    expect([...w.store.keys()]).toEqual(['ac-scheduler-v1'])
    expect(w.store.get('ac-scheduler-v1')?.size).toBe(FILES.length)
  })

  it('removes the caches of older versions, keeps other apps caches, and takes over the open pages', async () => {
    const w = boot()
    await w.run('install')
    w.store.set('ac-scheduler-old', new Map())
    w.store.set('other-app', new Map())
    await w.run('activate')
    expect([...w.store.keys()].sort()).toEqual(['ac-scheduler-v1', 'other-app'])
    expect(w.claim).toHaveBeenCalledOnce()
  })

  it('answers a stored file from the cache, also when the address has a query', async () => {
    const w = boot()
    await w.run('install')
    const res = await w.run('fetch', { request: w.get('/assets/a.js?v=2') })
    expect(await res?.text()).toBe('cached /assets/a.js')
    expect(w.network).not.toHaveBeenCalled()
  })

  it('answers a script that the page loads with an Origin header (a module script does), although the stored file says Vary: Origin', async () => {
    const w = boot()
    await w.run('install')
    const res = await w.run('fetch', { request: w.get('/assets/a.js', { mode: 'cors', headers: { origin: ORIGIN } }) })
    expect(await res?.text()).toBe('cached /assets/a.js')
    expect(w.network).not.toHaveBeenCalled()
  })

  it('opens the app page for any page address it does not know, so a reload works offline', async () => {
    const w = boot()
    await w.run('install')
    const res = await w.run('fetch', { request: w.get('/anything/here', { mode: 'navigate' }) })
    // The start address, not /index.html: a host may redirect /index.html to /, and a redirected answer cannot open a page.
    expect(await res?.text()).toBe('cached /')
  })

  it('never answers with a redirected copy, which a browser refuses for a page (a host may redirect /index.html to /)', async () => {
    const w = boot()
    await w.run('install')
    const res = await w.run('fetch', { request: w.get('/index.html', { mode: 'navigate' }) })
    expect(res?.redirected).toBe(false)
    expect(res?.status).toBe(200)
    expect(await res?.text()).toBe('cached /index.html')
  })

  it('asks the network for a file it does not have', async () => {
    const w = boot()
    await w.run('install')
    const res = await w.run('fetch', { request: w.get('/templates/new.csv') })
    expect(await res?.text()).toBe('network /templates/new.csv')
    expect(w.network).toHaveBeenCalledOnce()
  })

  it('leaves other methods and other sites alone', async () => {
    const w = boot()
    await w.run('install')
    expect(await w.run('fetch', { request: w.get('/assets/a.js', { method: 'POST' }) })).toBeUndefined()
    expect(await w.run('fetch', { request: { method: 'GET', mode: 'cors', url: 'https://other.example/x' } })).toBeUndefined()
  })

  it('waits for the person before taking over, and then takes over when told', async () => {
    const w = boot()
    await w.run('install')
    expect(w.skipWaiting).not.toHaveBeenCalled()
    await w.run('message', { data: 'something else' })
    expect(w.skipWaiting).not.toHaveBeenCalled()
    await w.run('message', { data: 'skip-waiting' })
    expect(w.skipWaiting).toHaveBeenCalledOnce()
  })
})
