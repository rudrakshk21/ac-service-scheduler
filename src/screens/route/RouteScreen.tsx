import { useEffect, useState } from 'react'
import { PackError, parsePack, staleness, type RoutePack } from '../../share/routePack'
import { memoryStore, openIndexedStore, type KeyValueStore } from '../../workspace/db'
import { readText } from '../files'
import { longDate, madeText } from './format'
import { addPack, loadPacks, removePack, savePacks } from './packStore'
import { RouteList } from './RouteList'
import './route.css'

const keyOf = (p: Pick<RoutePack, 'technician' | 'date'>): string => `${p.technician}|${p.date}`
const daysText = (n: number): string => (n === 1 ? 'yesterday' : `${n} days ago`)

/** What a technician sees: a route file from the planner, opened read-only, kept on the phone, usable with no connection. */
export default function RouteScreen() {
  const [store, setStore] = useState<KeyValueStore | null>(null)
  const [storageNote, setStorageNote] = useState<string | null>(null)
  const [packs, setPacks] = useState<RoutePack[]>([])
  const [chosen, setChosen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [today] = useState(() => new Date().toISOString().slice(0, 10))

  useEffect(() => {
    let live = true
    openIndexedStore().then(
      (s) => {
        if (!live) return
        setStore(s)
        void loadPacks(s).then((list) => { if (live) setPacks(list) }, () => undefined)
      },
      () => {
        if (!live) return
        setStore(memoryStore())
        setStorageNote('This browser is not keeping files for the app, so the route stays only while this page is open.')
      },
    )
    return () => { live = false }
  }, [])

  const pack = packs.find((p) => keyOf(p) === chosen) ?? packs[0]

  const keep = (next: RoutePack[]): void => {
    setPacks(next)
    if (store !== null) void savePacks(store, next).catch(() => setStorageNote('The route could not be saved on this phone. It stays only while this page is open.'))
  }

  async function open(file: File | undefined): Promise<void> {
    if (file === undefined) return
    try {
      const opened = parsePack(await readText(file))
      setError(null)
      setChosen(keyOf(opened))
      keep(addPack(packs, opened))
    } catch (e) {
      setError(e instanceof PackError ? e.message : 'The file could not be read.')
    }
  }

  const late = pack === undefined ? { past: false, daysAgo: 0 } : staleness(pack, today)

  return (
    <section className="screen stack">
      <div>
        <h1 className="screen-title" tabIndex={-1}>Route</h1>
        <p className="screen-lede">The route of one technician for one day, from a file made by the planner. It works without a connection.</p>
      </div>

      <div className="row">
        <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
          Open a route file
          <input type="file" accept=".json,application/json" className="visually-hidden" onChange={(e) => { void open(e.target.files?.[0]); e.target.value = '' }} />
        </label>
      </div>

      {error !== null && <p className="alert" role="alert">{error}</p>}
      {storageNote !== null && <p className="alert alert-note" role="status">{storageNote}</p>}

      {pack === undefined ? (
        <div className="empty">
          <h2>No route yet</h2>
          <p>Your coordinator sends you a route file for the day. Open it here. After that it stays on this phone and opens without a connection.</p>
        </div>
      ) : (
        <>
          <header>
            <h2 className="sheet-title">{pack.technician}</h2>
            <p className="sheet-date">{longDate(pack.date)}</p>
            <p className="muted small">{pack.site}. Made {madeText(pack.createdAt)}. If the plan has changed since, ask for a new file.</p>
          </header>
          {late.past && (
            <p className="alert" role="alert">This route was for {longDate(pack.validFor)}, {daysText(late.daysAgo)}. Ask for a new file if you need a later day.</p>
          )}
          <RouteList pack={pack} />
        </>
      )}

      {packs.length > 1 && (
        <section className="stack-tight" aria-label="Saved routes">
          <h2 className="step-heading">Saved on this phone</h2>
          <ul className="stack-tight" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {packs.map((p) => {
              const key = keyOf(p)
              const here = pack !== undefined && keyOf(pack) === key
              return (
                <li key={key} className="share-row">
                  <button type="button" className="btn" aria-pressed={here} onClick={() => { setChosen(key); setRemoving(null) }}>
                    {p.technician}, {longDate(p.date)}
                  </button>
                  {removing === key ? (
                    <span className="row">
                      <button type="button" className="btn danger" onClick={() => { keep(removePack(packs, p.technician, p.date)); setRemoving(null) }}>Yes, remove</button>
                      <button type="button" className="btn" onClick={() => setRemoving(null)}>Keep</button>
                    </span>
                  ) : (
                    <button type="button" className="btn danger" onClick={() => setRemoving(key)}>Remove</button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {pack !== undefined && packs.length === 1 && (
        <p className="row">
          {removing === keyOf(pack) ? (
            <>
              <button type="button" className="btn danger" onClick={() => { keep(removePack(packs, pack.technician, pack.date)); setRemoving(null) }}>Yes, remove this route</button>
              <button type="button" className="btn" onClick={() => setRemoving(null)}>Keep</button>
            </>
          ) : (
            <button type="button" className="btn danger" onClick={() => setRemoving(keyOf(pack))}>Remove this route</button>
          )}
        </p>
      )}
    </section>
  )
}
