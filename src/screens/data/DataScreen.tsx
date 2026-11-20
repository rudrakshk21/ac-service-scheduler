import { useEffect, useMemo, useRef, useState } from 'react'
import type { StoredCase, StoredState } from '../../intake/import/merge'
import { setCaseOverride } from '../../workspace/actions'
import { useWorkspace } from '../../workspace/useWorkspace'
import { KIND_LABELS } from '../import/importFlow'
import { countsByState, exceptionQueue, filterCases, STATE_ORDER, stateLabel, techniciansView, workTypeIndex } from './dataView'
import '../import/import.css'
import './data.css'

const PAGE = 100

function Chip({ name, index }: { name: string | undefined; index: number }) {
  return <span className={index >= 0 ? `wchip c${index % 6}` : 'wchip'}>{name ?? 'No work type'}</span>
}

function CaseDetail({ c, onBack }: { c: StoredCase; onBack: () => void }) {
  const { workspace, update } = useWorkspace()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  const set = (o: Parameters<typeof setCaseOverride>[2]) => update((w) => setCaseOverride(w, c.caseId, o))
  const facts: [string, string | undefined][] = [
    ['Place', c.place], ['Status in the file', c.status], ['Reported on', c.reportedAt], ['Due date', c.dueAt], ['Not before', c.earliestDate],
    ['Priority', c.priorityLevel ?? c.priority], ['Visit minutes', c.durationMin === undefined ? undefined : String(c.durationMin)],
    ['Product', c.productType], ['Technician in the file', c.technician], ['Notes', c.notes], ['Other reference', c.otherRef],
    ['First imported', c.firstImported], ['Last imported', c.lastImported],
  ]
  return (
    <section className="screen stack detail">
      <button type="button" className="btn" onClick={onBack} style={{ justifySelf: 'start' }}>Back to the list</button>
      <h1 className="screen-title" tabIndex={-1} ref={heading}>Case {c.caseId}</h1>
      <div className="row">
        <Chip name={c.workTypeName ?? c.workType} index={workTypeIndex(c.workTypeName, workspace.site.workTypes)} />
        <span className="badge">{stateLabel(c.state)}</span>
      </div>
      <dl className="card">
        {facts.filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      <div className="card stack">
        <h2 className="step-heading">Your decisions</h2>
        <p className="muted small">These stay when the file is imported again.</p>
        <label className="field">
          <span className="label">Visit by technician</span>
          <select value={c.overrides.technician ?? ''} onChange={(e) => set({ technician: e.target.value === '' ? undefined : e.target.value })}>
            <option value="">Let the planner choose</option>
            {workspace.technicians.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">On this date</span>
          <input type="date" value={c.overrides.date ?? ''} onChange={(e) => set({ date: e.target.value === '' ? undefined : e.target.value })} />
        </label>
        <div className="row">
          {c.state === 'done' ? (
            <button type="button" className="btn" onClick={() => set({ done: false })}>Reopen this case</button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => set({ done: true })}>Mark as done</button>
          )}
        </div>
      </div>
    </section>
  )
}

export default function DataScreen() {
  const { workspace } = useWorkspace()
  const { cases, technicians, site, imports } = workspace
  const [state, setState] = useState<StoredState | 'all'>('all')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [openId, setOpenId] = useState<string | null>(null)
  const counts = useMemo(() => countsByState(cases), [cases])
  const shown = useMemo(() => filterCases(cases, { state, query }), [cases, state, query])
  const queue = useMemo(() => exceptionQueue(cases), [cases])
  const open = openId === null ? undefined : cases.find((c) => c.caseId === openId)

  if (open !== undefined) return <CaseDetail c={open} onBack={() => setOpenId(null)} />

  if (cases.length === 0 && technicians.length === 0) {
    return (
      <section className="screen">
        <h1 className="screen-title" tabIndex={-1}>Data</h1>
        <div className="empty">
          <h2>Nothing imported yet</h2>
          <p>Import a file of service cases, technicians or places and they will be listed here.</p>
          <p style={{ marginTop: 16 }}><a className="btn btn-primary" href="#/import">Import a file</a></p>
        </div>
      </section>
    )
  }

  return (
    <section className="screen stack">
      <div>
        <h1 className="screen-title" tabIndex={-1}>Data</h1>
        <p className="screen-lede">{cases.length} {cases.length === 1 ? 'case' : 'cases'}, {technicians.length} {technicians.length === 1 ? 'technician' : 'technicians'}, {site.places.length} {site.places.length === 1 ? 'place' : 'places'}.</p>
      </div>

      {cases.length > 0 && (
        <>
          <div className="filters" role="group" aria-label="Show cases that are">
            <button type="button" className="filter" aria-pressed={state === 'all'} onClick={() => { setState('all'); setLimit(PAGE) }}>All {cases.length}</button>
            {STATE_ORDER.filter((s) => counts[s] > 0).map((s) => (
              <button key={s} type="button" className="filter" aria-pressed={state === s} onClick={() => { setState(s); setLimit(PAGE) }}>{stateLabel(s)} {counts[s]}</button>
            ))}
          </div>
          <label className="field">
            <span className="label">Search cases</span>
            <input type="search" value={query} placeholder="Identifier, work type, place…" onChange={(e) => { setQuery(e.target.value); setLimit(PAGE) }} />
          </label>
          <ul className="cases" aria-label="Cases">
            {shown.slice(0, limit).map((c) => (
              <li key={c.caseId}>
                <button type="button" className="card case" onClick={() => setOpenId(c.caseId)}>
                  <span className="case-id">{c.caseId}</span>
                  <span className="badge">{stateLabel(c.state)}</span>
                  <span className="meta">
                    <Chip name={c.workTypeName ?? c.workType} index={workTypeIndex(c.workTypeName, site.workTypes)} />
                    <span>{c.place ?? 'Place not found'}</span>
                    {c.dueAt !== undefined && <span>Due {c.dueAt}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className="muted">No case matches. Try fewer words or another filter.</p>}
          {shown.length > limit && <button type="button" className="btn" onClick={() => setLimit(limit + PAGE)}>Show more ({shown.length - limit} left)</button>}
        </>
      )}

      {queue.length > 0 && (
        <section className="stack-tight" aria-label="Problems to fix">
          <h2 className="step-heading">Problems to fix ({queue.length})</h2>
          <ul className="issues">
            {queue.slice(0, 20).map((q, i) => (
              <li key={i}><button type="button" className="btn" onClick={() => setOpenId(q.caseId)}>{q.caseId}</button> {q.issue === 'review' ? 'Needs review' : 'Place not found'}. {q.detail}</li>
            ))}
          </ul>
          {queue.length > 20 && <p className="muted small">And {queue.length - 20} more.</p>}
        </section>
      )}

      {technicians.length > 0 && (
        <section className="stack-tight" aria-label="Technicians">
          <h2 className="step-heading">Technicians ({technicians.length})</h2>
          <ul className="rows">
            {techniciansView(technicians).map((t) => (
              <li key={t.name}><span className="name">{t.name}</span><span>{t.skills}</span><span className="muted">{t.status}{t.leave !== '' ? `, ${t.leave}` : ''}</span></li>
            ))}
          </ul>
        </section>
      )}

      {imports.length > 0 && (
        <section className="stack-tight" aria-label="Import history">
          <h2 className="step-heading">Imports so far</h2>
          <ul className="rows">
            {[...imports].reverse().slice(0, 10).map((r, i) => (
              <li key={i}><span className="name">{r.fileName}</span><span>{KIND_LABELS[r.kind]}</span><span className="muted">{r.at}: {r.preview.new} new, {r.preview.updated} updated, {r.preview.unchanged} unchanged</span></li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
