import { useEffect, useState } from 'react'
import { parseSite, serializeSite } from '../../intake/site/site'
import { parseWorkspace, serializeWorkspace } from '../../workspace/backup'
import { promptInstall } from '../../pwa/register'
import { usePwa } from '../../pwa/usePwa'
import { useWorkspace } from '../../workspace/useWorkspace'
import { emptyWorkspace, type Workspace } from '../../workspace/workspace'
import { downloadText, readText, stamp } from '../files'
import { replaceSite } from './setupActions'

type Pending = { kind: 'restore'; workspace: Workspace; fileName: string } | { kind: 'delete' } | null

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
      say(`Loaded the set-up from ${file.name}.`)
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

  const sizeText = `${workspace.cases.length} cases, ${workspace.technicians.length} technicians, ${workspace.site.places.length} places`

  return (
    <section className="card stack" aria-labelledby="set-data">
      <h2 id="set-data" className="step-heading">Your data and files</h2>
      <p className="muted small">Everything is kept in this browser only. Nothing is sent anywhere. Now holding: {sizeText}.</p>

      <div className="stack-tight">
        <b>The set-up of your centre</b>
        <p className="muted small">Work types, skills, priority levels, places and rules, without any cases. Use it to set up another browser or share it.</p>
        <div className="row">
          <button type="button" className="btn" onClick={() => { downloadText(`site-setup-${stamp()}.json`, serializeSite(workspace.site)); say('Saved the set-up as a file.') }}>Save the set-up</button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            Load a set-up
            <input type="file" accept=".json,application/json" className="visually-hidden" onChange={(e) => { void loadSite(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
      </div>

      <div className="stack-tight">
        <b>A backup of everything</b>
        <p className="muted small">The set-up plus all cases, technicians and saved column matchings. It contains your case data, so keep it private.</p>
        <div className="row">
          <button type="button" className="btn" onClick={() => { downloadText(`backup-${stamp()}.json`, serializeWorkspace(workspace)); say('Saved a backup of everything.') }}>Save a backup</button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            Restore a backup
            <input type="file" accept=".json,application/json" className="visually-hidden" onChange={(e) => { void chooseBackup(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
      </div>

      {pending?.kind === 'restore' && (
        <div className="alert alert-note" role="alertdialog" aria-label="Restore a backup">
          <p>Restoring <b>{pending.fileName}</b> replaces everything now in the app with {pending.workspace.cases.length} cases, {pending.workspace.technicians.length} technicians and {pending.workspace.site.places.length} places.</p>
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-primary" onClick={() => { update(() => pending.workspace); setPending(null); say('Restored the backup.') }}>Replace everything</button>
            <button type="button" className="btn" onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="stack-tight">
        <b>Install on this device</b>
        <p className="muted small">Installed, the app opens full screen from the home screen and works without a connection.</p>
        {canInstall && (
          <div className="row"><button type="button" className="btn btn-primary" onClick={() => void promptInstall()}>Install the app</button></div>
        )}
        <details className="setup-details">
          <summary>If there is no install button</summary>
          <ul className="small stack-tight">
            <li>Chrome on Android: open the menu (three dots), then choose Install app or Add to Home screen.</li>
            <li>Samsung Internet: open the menu, choose Add page to, then Home screen.</li>
            <li>Firefox on Android: open the menu, then choose Install.</li>
            <li>Safari on iPhone: tap Share, then Add to Home Screen.</li>
          </ul>
        </details>
      </div>

      <div className="stack-tight">
        <b>Storage</b>
        <p className="muted small" role="status">
          {status === 'memory'
            ? 'This browser is not keeping your data. It will be lost when you close the page. Save a backup before you leave.'
            : persisted === true
              ? 'The browser has promised to keep your data.'
              : persisted === false
                ? 'The browser may clear your data when it runs short of space. Save a backup now and then.'
                : 'Checking whether the browser will keep your data…'}
        </p>
      </div>

      <div className="stack-tight">
        <b>Delete all my data</b>
        <p className="muted small">Removes the cases, technicians, places, saved matchings and set-up from this browser. This cannot be undone. Save a backup first if you may need it.</p>
        {pending?.kind === 'delete' ? (
          <div className="row">
            <button type="button" className="btn danger" onClick={() => { update(() => emptyWorkspace()); setPending(null); say('All data deleted.') }}>Yes, delete everything</button>
            <button type="button" className="btn" onClick={() => setPending(null)}>Keep my data</button>
          </div>
        ) : (
          <div className="row"><button type="button" className="btn danger" onClick={() => setPending({ kind: 'delete' })}>Delete all my data</button></div>
        )}
      </div>

      {message !== null && <p className={message.bad ? 'alert' : 'alert alert-note'} role={message.bad ? 'alert' : 'status'}>{message.text}</p>}
    </section>
  )
}
