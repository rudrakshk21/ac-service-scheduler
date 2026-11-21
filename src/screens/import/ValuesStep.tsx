import { formatNumber, t, tn } from '../../i18n'
import { useWorkspace } from '../../workspace/useWorkspace'
import { valueFields, valueOptions, valueRows, type ValueField } from './importFlow'
import type { StepProps } from './StepProps'

const TITLES = {
  workType: { title: 'import.values.workType.title', help: 'import.values.workType.help', empty: 'import.values.workType.empty' },
  status: { title: 'import.values.status.title', help: 'import.values.status.help', empty: 'import.values.status.empty' },
  priority: { title: 'import.values.priority.title', help: 'import.values.priority.help', empty: 'import.values.priority.empty' },
  skill: { title: 'import.values.skill.title', help: 'import.values.skill.help', empty: 'import.values.skill.empty' },
} as const satisfies Record<ValueField, { title: string; help: string; empty: string }>

export function ValuesStep({ flow, dispatch }: StepProps) {
  const { workspace } = useWorkspace()
  const { table, profile, kind } = flow
  if (table === null || profile === null) return null
  const fields = valueFields(kind, profile)

  return (
    <div className="stack">
      <h2 className="step-heading" tabIndex={-1} data-step-heading>{t('import.values.heading')}</h2>
      <p className="muted">{t('import.values.help')}</p>
      {fields.map((field) => {
        const rows = valueRows(table, profile, workspace.site, field)
        const options = valueOptions(workspace.site, field)
        const text = TITLES[field]
        const open = rows.filter((r) => r.target === null).length
        const title = open > 0 && field === 'workType' ? t('import.values.toMatch', { title: t(text.title), n: formatNumber(open) }) : t(text.title)
        return (
          <section key={field} className="stack-tight" aria-label={t(text.title)}>
            <h3 className="group-title">{title}</h3>
            <p className="muted small">{t(text.help)}</p>
            {rows.map((r) => {
              const id = `${field}-${r.source}`
              return (
                <div key={r.source} className={r.target === null && field === 'workType' ? 'card valuerow open' : 'card valuerow'}>
                  <span className="source">{r.source}</span>
                  <span className="muted small">{tn(kind === 'technicians' ? 'import.values.technicians' : 'import.values.cases', r.count)}</span>
                  <label className="field" htmlFor={id}>
                    <span className="visually-hidden">{t('import.values.matchTo', { source: r.source })}</span>
                    <select id={id} value={r.target ?? ''} onChange={(e) => dispatch({ type: 'value', field, source: r.source, target: e.target.value === '' ? null : e.target.value })}>
                      <option value="">{t(text.empty)}</option>
                      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                </div>
              )
            })}
            {field === 'workType' && open > 0 && (
              <label className="row">
                <input type="checkbox" checked={flow.leaveInReview} onChange={(e) => dispatch({ type: 'leaveInReview', on: e.target.checked })} />
                <span>{t('import.values.leaveInReview')}</span>
              </label>
            )}
          </section>
        )
      })}
    </div>
  )
}
