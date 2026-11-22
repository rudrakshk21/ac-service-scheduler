import { useEffect, useState } from 'react'
import { t, tn } from '../../i18n'
import type { Visit } from '../../share/report'
import { PackError, parsePack, staleness, type RoutePack } from '../../share/routePack'
import { memoryStore, openIndexedStore, type KeyValueStore } from '../../workspace/db'
import { readText } from '../files'
import { longDate, madeText } from './format'
import { addPack, loadPacks, removePack, savePacks } from './packStore'
import { PackMap } from './PackMap'
import { draftVisits, forgetVisit, loadDrafts, markSent, reportVisit, saveDrafts, sentAt, type Draft } from './reportStore'
import { RouteList } from './RouteList'
import { SendReport } from './SendReport'
import './route.css'

const keyOf = (p: Pick<RoutePack, 'technician' | 'date'>): string => `${p.technician}|${p.date}`

/** What a technician sees: a route file from the planner, opened read-only, kept on the phone, usable with no connection. */
export default function RouteScreen() {
  const [store, setStore] = useState<KeyValueStore | null>(null)
  const [storageNote, setStorageNote] = useState<string | null>(null)
  const [packs, setPacks] = useState<RoutePack[]>([])
  const [drafts, setDrafts] = useState<Draft[]>([])
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
        void loadDrafts(s).then((list) => { if (live) setDrafts(list) }, () => undefined)
      },
      () => {
        if (!live) return
        setStore(memoryStore())
        setStorageNote(t('route.storage.none'))
      },
    )
    return () => { live = false }
  }, [])

  const pack = packs.find((p) => keyOf(p) === chosen) ?? packs[0]

  const keep = (next: RoutePack[]): void => {
    setPacks(next)
    if (store !== null) void savePacks(store, next).catch(() => setStorageNote(t('route.storage.saveFailed')))
  }

  /** What the technician enters is kept on the phone at once, so closing the app or losing the signal loses nothing. */
  const keepDrafts = (next: Draft[]): void => {
    setDrafts(next)
    if (store !== null) void saveDrafts(store, next).catch(() => setStorageNote(t('route.storage.saveFailed')))
  }
  const visits = pack === undefined ? [] : draftVisits(drafts, pack.technician, pack.date)

  async function open(file: File | undefined): Promise<void> {
    if (file === undefined) return
    try {
      const opened = parsePack(await readText(file))
      setError(null)
      setChosen(keyOf(opened))
      keep(addPack(packs, opened))
    } catch (e) {
      setError(e instanceof PackError ? e.message : t('route.error.read'))
    }
  }

  const late = pack === undefined ? { past: false, daysAgo: 0 } : staleness(pack, today)

  return (
    <section className="screen stack">
      <div>
        <h1 className="screen-title" tabIndex={-1}>{t('route.title')}</h1>
        <p className="screen-lede">{t('route.lede')}</p>
      </div>

      <div className="row">
        <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
          {t('route.open')}
          <input type="file" accept=".json,application/json,.txt,text/plain" className="visually-hidden" onChange={(e) => { void open(e.target.files?.[0]); e.target.value = '' }} />
        </label>
      </div>

      {error !== null && <p className="alert" role="alert">{error}</p>}
      {storageNote !== null && <p className="alert alert-note" role="status">{storageNote}</p>}

      {pack === undefined ? (
        <div className="empty">
          <h2>{t('route.empty.title')}</h2>
          <p>{t('route.empty.text')}</p>
        </div>
      ) : (
        <>
          <header>
            <h2 className="sheet-title">{pack.technician}</h2>
            <p className="sheet-date">{longDate(pack.date)}</p>
            <p className="muted small">{t('route.made', { site: pack.site, when: madeText(pack.createdAt) })}</p>
          </header>
          {late.past && (
            <p className="alert" role="alert">{t('route.late', { date: longDate(pack.validFor), ago: tn('route.ago', late.daysAgo) })}</p>
          )}
          <PackMap pack={pack} />
          <RouteList
            pack={pack}
            reports={{
              visits,
              onChange: (visit: Visit) => keepDrafts(reportVisit(drafts, pack.technician, pack.date, visit)),
              onForget: (caseId: string) => keepDrafts(forgetVisit(drafts, pack.technician, pack.date, caseId)),
            }}
          />
          <SendReport pack={pack} visits={visits} sentAt={sentAt(drafts, pack.technician, pack.date)} onSent={(at) => keepDrafts(markSent(drafts, pack.technician, pack.date, at))} />
        </>
      )}

      {packs.length > 1 && (
        <section className="stack-tight" aria-label={t('route.saved.aria')}>
          <h2 className="step-heading">{t('route.saved.title')}</h2>
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
                      <button type="button" className="btn danger" onClick={() => { keep(removePack(packs, p.technician, p.date)); setRemoving(null) }}>{t('route.removeYes')}</button>
                      <button type="button" className="btn" onClick={() => setRemoving(null)}>{t('route.keep')}</button>
                    </span>
                  ) : (
                    <button type="button" className="btn danger" onClick={() => setRemoving(key)}>{t('route.remove')}</button>
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
              <button type="button" className="btn danger" onClick={() => { keep(removePack(packs, pack.technician, pack.date)); setRemoving(null) }}>{t('route.removeThisYes')}</button>
              <button type="button" className="btn" onClick={() => setRemoving(null)}>{t('route.keep')}</button>
            </>
          ) : (
            <button type="button" className="btn danger" onClick={() => setRemoving(keyOf(pack))}>{t('route.removeThis')}</button>
          )}
        </p>
      )}
    </section>
  )
}
