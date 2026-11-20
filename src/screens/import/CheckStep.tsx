import { useMemo, useState } from 'react'
import { applyProfile, type IssueCode } from '../../intake/map/apply'
import { applyImport, previewImport } from '../../workspace/actions'
import { useWorkspace } from '../../workspace/useWorkspace'
import { labelOf } from './importFlow'
import type { StepProps } from './StepProps'

const ISSUE_TEXT: Record<IssueCode, string> = {
  missing_id: 'No identifier',
  no_location: 'Place not found',
  unknown_work_type: 'Category not matched',
  bad_date: 'Unreadable date',
  duplicate_id: 'Repeated identifier',
}
const NOUN = { cases: ['case', 'cases'], technicians: ['technician', 'technicians'], places: ['place', 'places'] } as const

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
  const [one, many] = NOUN[kind]
  const noun = count === 1 ? one : many
  const q = imported.quality
  const exceptions = imported.exceptions

  const detail = kind === 'cases' ? ` (${preview.new} new, ${preview.updated} updated, ${preview.unchanged} unchanged)` : kind === 'technicians' ? ` (${preview.new} new, ${preview.updated} updated)` : ` (${preview.new} new)`
  const summary = [
    `Imported ${count} ${noun}.`,
    `${preview.new} new, ${preview.updated} updated, ${preview.unchanged} unchanged.`,
    ...(preview.removed > 0 ? [`${preview.removed} no longer in the file and now closed.`] : []),
    ...(exceptions.length > 0 ? [`${exceptions.length} ${exceptions.length === 1 ? 'problem' : 'problems'} to look at in the Data tab.`] : []),
  ]

  const run = () => {
    update((w) => applyImport(w, imported, profile, flow.fileName, today).workspace)
    onDone(summary)
    dispatch({ type: 'imported' })
  }

  return (
    <div className="stack">
      <h2 className="step-heading" tabIndex={-1} data-step-heading>Check and import</h2>

      <div className="facts" role="group" aria-label="What was read">
        <div className="fact"><b>{q.rowsRead}</b>rows read</div>
        <div className="fact"><b>{count}</b>{many} to import</div>
        {kind === 'cases' && <div className="fact"><b>{preview.new}</b>new</div>}
        {kind === 'cases' && <div className="fact"><b>{preview.updated}</b>updated</div>}
        {kind === 'cases' && <div className="fact"><b>{preview.unchanged}</b>unchanged</div>}
        {preview.removed > 0 && <div className="fact"><b>{preview.removed}</b>no longer in the file</div>}
        {q.duplicates > 0 && <div className="fact"><b>{q.duplicates}</b>repeated</div>}
        {q.totalRowsSkipped > 0 && <div className="fact"><b>{q.totalRowsSkipped}</b>total rows skipped</div>}
        {q.blankRowsSkipped > 0 && <div className="fact"><b>{q.blankRowsSkipped}</b>blank rows skipped</div>}
      </div>

      <section className="stack-tight" aria-label="How complete the data is">
        <h3 className="group-title">How complete the data is</h3>
        <div className="bars">
          {Object.entries(q.filled).map(([field, share]) => {
            const pct = Math.round(share * 100)
            return (
              <div key={field} className="bar">
                <span>{labelOf(kind, field)}</span>
                <span className="track" role="img" aria-label={`${labelOf(kind, field)}: ${pct} percent filled`}><span className="fill" style={{ width: `${pct}%` }} /></span>
                <span className="pct">{pct}%</span>
              </div>
            )
          })}
        </div>
      </section>

      {(q.badDates.length > 0 || q.unknownValues.length > 0 || q.unresolvedPlaces > 0) && (
        <section className="stack-tight" aria-label="Things to look at">
          <h3 className="group-title">Things to look at</h3>
          <ul className="issues">
            {q.badDates.map((b) => <li key={b.field}>{b.count} {labelOf(kind, b.field).toLowerCase()} {b.count === 1 ? 'value is' : 'values are'} not a date, for example {b.examples.map((e) => `“${e}”`).join(', ')}.</li>)}
            {q.unknownValues.map((u) => <li key={u.field}>Words not matched: {u.values.slice(0, 8).map((v) => `“${v}”`).join(', ')}{u.values.length > 8 ? ` and ${u.values.length - 8} more` : ''}.</li>)}
            {q.unresolvedPlaces > 0 && <li>{q.unresolvedPlaces} {q.unresolvedPlaces === 1 ? 'place was' : 'places were'} not found. Those cases are imported and wait in the problem list until the place is added.</li>}
          </ul>
        </section>
      )}

      {exceptions.length > 0 && (
        <details className="options">
          <summary>{exceptions.length} {exceptions.length === 1 ? 'problem' : 'problems'}, first {Math.min(20, exceptions.length)}</summary>
          <ul className="issues">
            {exceptions.slice(0, 20).map((e, i) => <li key={i}><b>{e.caseId}</b>: {ISSUE_TEXT[e.issue]}. {e.detail}</li>)}
          </ul>
        </details>
      )}

      {count === 0 ? (
        <p className="alert" role="alert">Nothing can be imported with this matching. Go back and check the columns.</p>
      ) : (
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={run}>Import {count} {noun}{detail}</button>
        </div>
      )}
    </div>
  )
}
