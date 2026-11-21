import { useMemo, useState } from 'react'
import { formatNumber, t, tn, type MessageKey, type PluralKey } from '../../i18n'
import { applyProfile } from '../../intake/map/apply'
import { applyImport, previewImport } from '../../workspace/actions'
import { useWorkspace } from '../../workspace/useWorkspace'
import { askToKeepData } from '../files'
import { labelOf } from './importFlow'
import type { StepProps } from './StepProps'

interface CheckProps extends StepProps {
  onDone: (lines: string[]) => void
}

export function CheckStep({ flow, dispatch, onDone }: CheckProps) {
  const { workspace, update } = useWorkspace()
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const { table, profile, kind } = flow
  const imported = useMemo(() => (table !== null && profile !== null ? applyProfile(table, profile, workspace.site, today) : null), [table, profile, workspace.site, today])
  const preview = useMemo(() => (imported !== null && profile !== null ? previewImport(workspace, imported, profile, today) : null), [workspace, imported, profile, today])
  if (imported === null || preview === null || profile === null) return null

  const count = kind === 'cases' ? imported.cases.length : kind === 'technicians' ? imported.technicians.length : imported.places.length
  const q = imported.quality
  const exceptions = imported.exceptions
  const n = {
    new: formatNumber(preview.new),
    updated: formatNumber(preview.updated),
    unchanged: formatNumber(preview.unchanged),
  }

  const detail = t(`import.detail.${kind}` as MessageKey, n)
  const summary = [
    tn(`import.summary.${kind}` as PluralKey, count),
    t('import.summary.counts', n),
    ...(preview.removed > 0 ? [t('import.summary.removed', { count: formatNumber(preview.removed) })] : []),
    ...(exceptions.length > 0 ? [tn('import.summary.problems', exceptions.length)] : []),
  ]

  const run = () => {
    update((w) => applyImport(w, imported, profile, flow.fileName, today).workspace)
    askToKeepData()
    onDone(summary)
    dispatch({ type: 'imported' })
  }

  const quoted = (values: string[]): string => values.map((v) => `“${v}”`).join(', ')

  return (
    <div className="stack">
      <h2 className="step-heading" tabIndex={-1} data-step-heading>{t('import.check.heading')}</h2>

      <div className="facts" role="group" aria-label={t('import.check.read.aria')}>
        <div className="fact"><b>{formatNumber(q.rowsRead)}</b>{t('import.fact.rows')}</div>
        <div className="fact"><b>{formatNumber(count)}</b>{t(`import.fact.toImport.${kind}` as MessageKey)}</div>
        {kind === 'cases' && <div className="fact"><b>{n.new}</b>{t('import.fact.new')}</div>}
        {kind === 'cases' && <div className="fact"><b>{n.updated}</b>{t('import.fact.updated')}</div>}
        {kind === 'cases' && <div className="fact"><b>{n.unchanged}</b>{t('import.fact.unchanged')}</div>}
        {preview.removed > 0 && <div className="fact"><b>{formatNumber(preview.removed)}</b>{t('import.fact.removed')}</div>}
        {q.duplicates > 0 && <div className="fact"><b>{formatNumber(q.duplicates)}</b>{t('import.fact.repeated')}</div>}
        {q.totalRowsSkipped > 0 && <div className="fact"><b>{formatNumber(q.totalRowsSkipped)}</b>{t('import.fact.totalSkipped')}</div>}
        {q.blankRowsSkipped > 0 && <div className="fact"><b>{formatNumber(q.blankRowsSkipped)}</b>{t('import.fact.blankSkipped')}</div>}
      </div>

      <section className="stack-tight" aria-label={t('import.check.complete')}>
        <h3 className="group-title">{t('import.check.complete')}</h3>
        <div className="bars">
          {Object.entries(q.filled).map(([field, share]) => {
            const pct = Math.round(share * 100)
            return (
              <div key={field} className="bar">
                <span>{labelOf(kind, field)}</span>
                <span className="track" role="img" aria-label={t('import.check.filled.aria', { field: labelOf(kind, field), pct: formatNumber(pct) })}><span className="fill" style={{ width: `${pct}%` }} /></span>
                <span className="pct">{formatNumber(pct)}%</span>
              </div>
            )
          })}
        </div>
      </section>

      {(q.badDates.length > 0 || q.unknownValues.length > 0 || q.unresolvedPlaces > 0) && (
        <section className="stack-tight" aria-label={t('import.check.look')}>
          <h3 className="group-title">{t('import.check.look')}</h3>
          <ul className="issues">
            {q.badDates.map((b) => <li key={b.field}>{tn('import.check.badDates', b.count, { field: labelOf(kind, b.field).toLocaleLowerCase(), examples: quoted(b.examples) })}</li>)}
            {q.unknownValues.map((u) => <li key={u.field}>{t('import.check.unknown', { values: quoted(u.values.slice(0, 8)), more: u.values.length > 8 ? t('import.check.unknown.more', { count: formatNumber(u.values.length - 8) }) : '' })}</li>)}
            {q.unresolvedPlaces > 0 && <li>{tn('import.check.places', q.unresolvedPlaces)}</li>}
          </ul>
        </section>
      )}

      {exceptions.length > 0 && (
        <details className="options">
          <summary>{tn('import.check.problems', exceptions.length, { first: formatNumber(Math.min(20, exceptions.length)) })}</summary>
          <ul className="issues">
            {exceptions.slice(0, 20).map((e, i) => <li key={i}><b>{e.caseId}</b>: {t('import.check.issueLine', { issue: t(`import.issue.${e.issue}` as MessageKey), detail: e.detail })}</li>)}
          </ul>
        </details>
      )}

      {count === 0 ? (
        <p className="alert" role="alert">{t('import.check.nothing')}</p>
      ) : (
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={run}>{tn(`import.run.${kind}` as PluralKey, count, { detail })}</button>
        </div>
      )}
    </div>
  )
}
