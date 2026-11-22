import { useEffect, useState } from 'react'
import { formatNumber, t, tn } from '../../i18n'
import { parseSite, serializeSite } from '../../intake/site/site'
import { parseWorkspace } from '../../workspace/backup'
import { promptInstall } from '../../pwa/register'
import { usePwa } from '../../pwa/usePwa'
import { openIndexedStore } from '../../workspace/db'
import { isRetentionDays, previewRetention, RETENTION_CHOICES, setRetention, type Removed, type RetentionDays } from '../../workspace/retention'
import { useWorkspace } from '../../workspace/useWorkspace'
import { emptyWorkspace, type Workspace } from '../../workspace/workspace'
import { clearPacks } from '../route/packStore'
import { clearDrafts } from '../route/reportStore'
import { downloadText, readText, saveBackupFile, stamp } from '../files'
import { replaceSite } from './setupActions'

type Pending =
  | { kind: 'restore'; workspace: Workspace; fileName: string }
  | { kind: 'delete' }
  | { kind: 'retention'; days: RetentionDays; finishedKept: number; removeNow: Removed }
  | null

/** What a pass removed, in words ("3 finished cases, 12 reports"), or "nothing". */
function whatWent(r: Removed): string {
  const parts = [
    r.cases > 0 ? tn('retention.cases', r.cases) : '',
    r.reports > 0 ? tn('reports.count', r.reports) : '',
    r.changes > 0 ? tn('retention.lines', r.changes) : '',
  ].filter((x) => x !== '')
  return parts.length === 0 ? t('setup.data.retention.nothing') : parts.join(', ')
}

/** The route files opened on this device, and what was reported on them, are data too: "delete all my data" removes them with the rest. */
async function deleteSavedRoutes(): Promise<void> {
  try {
    const store = await openIndexedStore()
    await clearPacks(store)
    await clearDrafts(store)
  } catch {
    // No browser storage: there are no saved routes to delete.
  }
}

export function DataSection() {
  const { workspace, update, status } = useWorkspace()
  const { canInstall } = usePwa()
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    let live = true
    void navigator.storage?.persisted?.().then((p) => { if (live) setPersisted(p) }, () => undefined)
    return () => { live = false }
  }, [status, workspace.imports.length])

  const say = (text: string, bad = false) => setMessage({ text, bad })

  async function loadSite(file: File | undefined) {
    if (file === undefined) return
    try {
      const site = parseSite(await readText(file))
      update((w) => replaceSite(w, site))
      say(t('setup.data.msg.loaded', { file: file.name }))
    } catch (e) {
      say(e instanceof Error ? e.message : String(e), true)
    }
  }

  async function chooseBackup(file: File | undefined) {
    if (file === undefined) return
    try {
      setPending({ kind: 'restore', workspace: parseWorkspace(await readText(file)), fileName: file.name })
      setMessage(null)
    } catch (e) {
      say(e instanceof Error ? e.message : String(e), true)
    }
  }

  /** Off takes effect at once (it removes nothing). A period first shows what it would remove, and asks. */
  function chooseRetention(value: string): void {
    if (value === '') {
      update((w) => setRetention(w, undefined, stamp()).workspace)
      setPending(null)
      say(t('setup.data.msg.retentionOff'))
      return
    }
    const days = Number(value)
    if (!isRetentionDays(days)) return
    setPending({ kind: 'retention', days, ...previewRetention(workspace, days, stamp()) })
    setMessage(null)
  }

  function applyRetentionChoice(days: RetentionDays): void {
    const done = setRetention(workspace, days, stamp())
    update(() => done.workspace)
    setPending(null)
    const removed = done.removed.cases + done.removed.reports + done.removed.changes > 0
    say(`${t('setup.data.msg.retentionOn', { days: formatNumber(days) })}${removed ? ` ${t('setup.data.retention.now', { what: whatWent(done.removed) })}` : ''}`)
  }

  const sizeOf = (cases: number, technicians: number, places: number): string =>
    t('setup.data.size', { cases: tn('data.cases', cases), technicians: tn('data.technicians', technicians), places: tn('data.places', places) })

  return (
    <section className="card stack" aria-labelledby="set-data">
      <h2 id="set-data" className="step-heading">{t('setup.data.title')}</h2>
      <p className="muted small">{t('setup.data.where', { size: sizeOf(workspace.cases.length, workspace.technicians.length, workspace.site.places.length) })}</p>
      <p className="muted small">{t('setup.data.privacy')}</p>

      <div className="stack-tight">
        <b>{t('setup.data.site.title')}</b>
        <p className="muted small">{t('setup.data.site.help')}</p>
        <div className="row">
          <button type="button" className="btn" onClick={() => { downloadText(`site-setup-${stamp()}.json`, serializeSite(workspace.site)); say(t('setup.data.msg.savedSite')) }}>{t('setup.data.site.save')}</button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            {t('setup.data.site.load')}
            <input type="file" accept=".json,application/json" className="visually-hidden" onChange={(e) => { void loadSite(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
      </div>

      <div className="stack-tight">
        <b>{t('setup.data.backup.title')}</b>
        <p className="muted small">{t('setup.data.backup.help')}</p>
        <div className="row">
          <button type="button" className="btn" onClick={() => { saveBackupFile(workspace, update); say(t('setup.data.msg.savedBackup')) }}>{t('backup.save')}</button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            {t('setup.data.backup.restore')}
            <input type="file" accept=".json,application/json" className="visually-hidden" onChange={(e) => { void chooseBackup(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
      </div>

      {pending?.kind === 'restore' && (
        <div className="alert alert-note" role="alertdialog" aria-label={t('setup.data.restore.aria')}>
          <p>{t('setup.data.restore.text', { file: pending.fileName, cases: tn('data.cases', pending.workspace.cases.length), technicians: tn('data.technicians', pending.workspace.technicians.length), places: tn('data.places', pending.workspace.site.places.length) })}</p>
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-primary" onClick={() => { update(() => pending.workspace); setPending(null); say(t('setup.data.msg.restored')) }}>{t('setup.data.restore.yes')}</button>
            <button type="button" className="btn" onClick={() => setPending(null)}>{t('setup.data.cancel')}</button>
          </div>
        </div>
      )}

      <div className="stack-tight">
        <b>{t('setup.data.install.title')}</b>
        <p className="muted small">{t('setup.data.install.help')}</p>
        {canInstall && (
          <div className="row"><button type="button" className="btn btn-primary" onClick={() => void promptInstall()}>{t('setup.data.install.button')}</button></div>
        )}
        <details className="setup-details">
          <summary>{t('setup.data.install.noButton')}</summary>
          <ul className="small stack-tight">
            <li>{t('setup.data.install.chrome')}</li>
            <li>{t('setup.data.install.samsung')}</li>
            <li>{t('setup.data.install.firefox')}</li>
            <li>{t('setup.data.install.safari')}</li>
          </ul>
        </details>
      </div>

      <div className="stack-tight">
        <b>{t('setup.data.storage.title')}</b>
        <p className="muted small" role="status">
          {status === 'memory'
            ? t('setup.data.storage.memory')
            : persisted === true
              ? t('setup.data.storage.kept')
              : persisted === false
                ? t('setup.data.storage.mayClear')
                : t('setup.data.storage.checking')}
        </p>
      </div>

      <div className="stack-tight">
        <label htmlFor="set-retention"><b>{t('setup.data.retention.title')}</b></label>
        <p className="muted small">{t('setup.data.retention.help')}</p>
        <div className="row">
          <select id="set-retention" value={workspace.retentionDays ?? ''} onChange={(e) => chooseRetention(e.target.value)}>
            <option value="">{t('setup.data.retention.off')}</option>
            {RETENTION_CHOICES.map((d) => <option key={d} value={d}>{t(`setup.data.retention.opt.${d}`)}</option>)}
          </select>
        </div>
        <p className="muted small" role="status">
          {workspace.retentionDays === undefined ? t('setup.data.retention.statusOff') : t('setup.data.retention.statusOn', { days: formatNumber(workspace.retentionDays) })}
        </p>
        {pending?.kind === 'retention' && (
          <div className="alert alert-note" role="alertdialog" aria-label={t('setup.data.retention.aria')}>
            <p><b>{t('setup.data.retention.confirm', { days: formatNumber(pending.days) })}</b></p>
            <p>{t('setup.data.retention.finished', { count: formatNumber(pending.finishedKept), days: formatNumber(pending.days) })}</p>
            <p>{t('setup.data.retention.now', { what: whatWent(pending.removeNow) })}</p>
            <p>{t('setup.data.retention.catch')}</p>
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" className="btn btn-primary" onClick={() => applyRetentionChoice(pending.days)}>{t('setup.data.retention.yes', { days: formatNumber(pending.days) })}</button>
              <button type="button" className="btn" onClick={() => setPending(null)}>{t('setup.data.cancel')}</button>
            </div>
          </div>
        )}
      </div>

      <div className="stack-tight">
        <b>{t('setup.data.delete.title')}</b>
        <p className="muted small">{t('setup.data.delete.help')}</p>
        {pending?.kind === 'delete' ? (
          <div className="row">
            <button type="button" className="btn danger" onClick={() => { update(() => emptyWorkspace()); void deleteSavedRoutes(); setPending(null); say(t('setup.data.msg.deleted')) }}>{t('setup.data.delete.yes')}</button>
            <button type="button" className="btn" onClick={() => setPending(null)}>{t('setup.data.delete.keep')}</button>
          </div>
        ) : (
          <div className="row"><button type="button" className="btn danger" onClick={() => setPending({ kind: 'delete' })}>{t('setup.data.delete.title')}</button></div>
        )}
      </div>

      {message !== null && <p className={message.bad ? 'alert' : 'alert alert-note'} role={message.bad ? 'alert' : 'status'}>{message.text}</p>}
    </section>
  )
}
