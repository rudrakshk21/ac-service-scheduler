import { useWorkspace } from '../../workspace/useWorkspace'
import { valueFields, valueOptions, valueRows, type ValueField } from './importFlow'
import type { StepProps } from './StepProps'

const TITLES: Record<ValueField, { title: string; help: string; empty: string }> = {
  workType: { title: 'Work types', help: 'Match each category in your file to one of your work types.', empty: 'Not matched yet' },
  status: { title: 'Status', help: 'Say what to do with cases in each status. A status you do not match is planned.', empty: 'Plan it (not matched)' },
  priority: { title: 'Priority', help: 'Match each priority word to a priority level. One you do not match counts as the lowest level.', empty: 'Lowest level (not matched)' },
  skill: { title: 'Skills', help: 'Match each skill word to one of your skills. One you do not match is left out.', empty: 'Left out (not matched)' },
}

export function ValuesStep({ flow, dispatch }: StepProps) {
  const { workspace } = useWorkspace()
  const { table, profile, kind } = flow
  if (table === null || profile === null) return null
  const fields = valueFields(kind, profile)

  return (
    <div className="stack">
      <h2 className="step-heading" tabIndex={-1} data-step-heading>Match the words</h2>
      <p className="muted">Your file uses its own words. Match each one once; the app remembers them for the next file.</p>
      {fields.map((field) => {
        const rows = valueRows(table, profile, workspace.site, field)
        const options = valueOptions(workspace.site, field)
        const t = TITLES[field]
        const open = rows.filter((r) => r.target === null).length
        return (
          <section key={field} className="stack-tight" aria-label={t.title}>
            <h3 className="group-title">{t.title}{open > 0 && field === 'workType' ? ` (${open} to match)` : ''}</h3>
            <p className="muted small">{t.help}</p>
            {rows.map((r) => {
              const id = `${field}-${r.source}`
              return (
                <div key={r.source} className={r.target === null && field === 'workType' ? 'card valuerow open' : 'card valuerow'}>
                  <span className="source">{r.source}</span>
                  <span className="muted small">{r.count} {kind === 'technicians' ? (r.count === 1 ? 'technician' : 'technicians') : r.count === 1 ? 'case' : 'cases'}</span>
                  <label className="field" htmlFor={id}>
                    <span className="visually-hidden">Match “{r.source}” to</span>
                    <select id={id} value={r.target ?? ''} onChange={(e) => dispatch({ type: 'value', field, source: r.source, target: e.target.value === '' ? null : e.target.value })}>
                      <option value="">{t.empty}</option>
                      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                </div>
              )
            })}
            {field === 'workType' && open > 0 && (
              <label className="row">
                <input type="checkbox" checked={flow.leaveInReview} onChange={(e) => dispatch({ type: 'leaveInReview', on: e.target.checked })} />
                <span>Leave unmatched categories in review for now</span>
              </label>
            )}
          </section>
        )
      })}
    </div>
  )
}
