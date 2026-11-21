import { useEffect, useMemo, useRef, useState } from 'react'
import { formatNumber, t, tn } from '../../i18n'
import type { StoredCase, StoredState } from '../../intake/import/merge'
import { setCaseOverride } from '../../workspace/actions'
import { useWorkspace } from '../../workspace/useWorkspace'
import { kindLabel } from '../import/importFlow'
import { countsByState, exceptionQueue, filterCases, STATE_ORDER, stateLabel, techniciansView, workTypeIndex } from './dataView'
import '../import/import.css'
import './data.css'

const PAGE = 100

function Chip({ name, index }: { name: string | undefined; index: number }) {
  return <span className={index >= 0 ? `wchip c${index % 6}` : 'wchip'}>{name ?? t('data.noWorkType')}</span>
}

function CaseDetail({ c, onBack }: { c: StoredCase; onBack: () => void }) {
  const { workspace, update } = useWorkspace()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  const set = (o: Parameters<typeof setCaseOverride>[2]) => update((w) => setCaseOverride(w, c.caseId, o))
  const facts: [string, string | undefined][] = [
    [t('data.fact.place'), c.place], [t('data.fact.status'), c.status], [t('data.fact.reported'), c.reportedAt], [t('data.fact.due'), c.dueAt],
    [t('data.fact.notBefore'), c.earliestDate], [t('data.fact.priority'), c.priorityLevel ?? c.priority],
    [t('data.fact.minutes'), c.durationMin === undefined ? undefined : String(c.durationMin)],
    [t('data.fact.product'), c.productType], [t('data.fact.technician'), c.technician], [t('data.fact.notes'), c.notes],
    [t('data.fact.otherRef'), c.otherRef], [t('data.fact.firstImported'), c.firstImported], [t('data.fact.lastImported'), c.lastImported],
  ]
  return (
    <section className="screen stack detail">
      <button type="button" className="btn" onClick={onBack} style={{ justifySelf: 'start' }}>{t('data.back')}</button>
      <h1 className="screen-title" tabIndex={-1} ref={heading}>{t('data.caseTitle', { id: c.caseId })}</h1>
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
        <h2 className="step-heading">{t('data.decisions')}</h2>
        <p className="muted small">{t('data.decisions.note')}</p>
        <label className="field">
          <span className="label">{t('data.byTech')}</span>
          <select value={c.overrides.technician ?? ''} onChange={(e) => set({ technician: e.target.value === '' ? undefined : e.target.value })}>
            <option value="">{t('data.plannerChooses')}</option>
            {workspace.technicians.map((tech) => <option key={tech.name} value={tech.name}>{tech.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="label">{t('data.onDate')}</span>
          <input type="date" value={c.overrides.date ?? ''} onChange={(e) => set({ date: e.target.value === '' ? undefined : e.target.value })} />
        </label>
        <div className="row">
          {c.state === 'done' ? (
            <button type="button" className="btn" onClick={() => set({ done: false })}>{t('data.reopen')}</button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => set({ done: true })}>{t('data.markDone')}</button>
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
        <h1 className="screen-title" tabIndex={-1}>{t('data.title')}</h1>
        <div className="empty">
          <h2>{t('data.empty.title')}</h2>
          <p>{t('data.empty.text')}</p>
          <p style={{ marginTop: 16 }}><a className="btn btn-primary" href="#/import">{t('data.empty.action')}</a></p>
        </div>
      </section>
    )
  }

  return (
    <section className="screen stack">
      <div>
        <h1 className="screen-title" tabIndex={-1}>{t('data.title')}</h1>
        <p className="screen-lede">{t('data.lede', { cases: tn('data.cases', cases.length), technicians: tn('data.technicians', technicians.length), places: tn('data.places', site.places.length) })}</p>
      </div>

      {cases.length > 0 && (
        <>
          <div className="filters" role="group" aria-label={t('data.filters.aria')}>
            <button type="button" className="filter" aria-pressed={state === 'all'} onClick={() => { setState('all'); setLimit(PAGE) }}>{t('data.filters.all', { n: formatNumber(cases.length) })}</button>
            {STATE_ORDER.filter((s) => counts[s] > 0).map((s) => (
              <button key={s} type="button" className="filter" aria-pressed={state === s} onClick={() => { setState(s); setLimit(PAGE) }}>{t('data.filters.state', { state: stateLabel(s), n: formatNumber(counts[s]) })}</button>
            ))}
          </div>
          <label className="field">
            <span className="label">{t('data.search')}</span>
            <input type="search" value={query} placeholder={t('data.search.placeholder')} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE) }} />
          </label>
          <ul className="cases" aria-label={t('data.list.aria')}>
            {shown.slice(0, limit).map((c) => (
              <li key={c.caseId}>
                <button type="button" className="card case" onClick={() => setOpenId(c.caseId)}>
                  <span className="case-id">{c.caseId}</span>
                  <span className="badge">{stateLabel(c.state)}</span>
                  <span className="meta">
                    <Chip name={c.workTypeName ?? c.workType} index={workTypeIndex(c.workTypeName, site.workTypes)} />
                    <span>{c.place ?? t('data.placeNotFound')}</span>
                    {c.dueAt !== undefined && <span>{t('data.due', { date: c.dueAt })}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {shown.length === 0 && <p className="muted">{t('data.noMatch')}</p>}
          {shown.length > limit && <button type="button" className="btn" onClick={() => setLimit(limit + PAGE)}>{t('data.showMore', { n: formatNumber(shown.length - limit) })}</button>}
        </>
      )}

      {queue.length > 0 && (
        <section className="stack-tight" aria-label={t('data.problems.aria')}>
          <h2 className="step-heading">{t('data.problems.title', { n: formatNumber(queue.length) })}</h2>
          <ul className="issues">
            {queue.slice(0, 20).map((q, i) => (
              <li key={i}><button type="button" className="btn" onClick={() => setOpenId(q.caseId)}>{q.caseId}</button> {t('data.problems.line', { issue: q.issue === 'review' ? t('data.problems.review') : t('data.problems.noPlace'), detail: q.detail })}</li>
            ))}
          </ul>
          {queue.length > 20 && <p className="muted small">{t('common.andMore', { count: formatNumber(queue.length - 20) })}</p>}
        </section>
      )}

      {technicians.length > 0 && (
        <section className="stack-tight" aria-label={t('data.technicians.aria')}>
          <h2 className="step-heading">{t('data.technicians.title', { n: formatNumber(technicians.length) })}</h2>
          <ul className="rows">
            {techniciansView(technicians).map((row) => (
              <li key={row.name}><span className="name">{row.name}</span><span>{row.skills}</span><span className="muted">{row.status}{row.leave !== '' ? `, ${row.leave}` : ''}</span></li>
            ))}
          </ul>
        </section>
      )}

      {imports.length > 0 && (
        <section className="stack-tight" aria-label={t('data.imports.aria')}>
          <h2 className="step-heading">{t('data.imports.title')}</h2>
          <ul className="rows">
            {[...imports].reverse().slice(0, 10).map((r, i) => (
              <li key={i}><span className="name">{r.fileName}</span><span>{kindLabel(r.kind)}</span><span className="muted">{t('data.imports.line', { date: r.at, new: formatNumber(r.preview.new), updated: formatNumber(r.preview.updated), unchanged: formatNumber(r.preview.unchanged) })}</span></li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
