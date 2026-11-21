import { t } from '../../i18n'
import { useWorkspace } from '../../workspace/useWorkspace'
import { dateReadings, fieldRows, sampleValues, type FieldRow, type Level } from './importFlow'
import type { StepProps } from './StepProps'

const LEVEL_TEXT = { required: 'import.level.required', recommended: 'import.level.recommended', optional: 'import.level.optional' } as const
const GROUPS = [
  { level: 'required', title: 'import.group.required' },
  { level: 'recommended', title: 'import.group.recommended' },
  { level: 'optional', title: 'import.group.optional' },
] as const satisfies readonly { level: Level; title: string }[]
const MANY = ['area', 'skills']
const DATE_FIELDS = ['reportedAt', 'dueAt', 'earliestDate', 'leaveFrom', 'leaveTo']

export function ColumnsStep({ flow, dispatch }: StepProps) {
  const { workspace } = useWorkspace()
  const { table, result, profile, kind } = flow
  if (table === null || result === null || profile === null) return null
  const rows = fieldRows(kind, table, result, profile)

  const setField = (row: FieldRow, slot: number, value: string) => {
    const slots = MANY.includes(row.field) ? [...row.chosen, ''] : [row.chosen[0] ?? '']
    slots[slot] = value
    dispatch({ type: 'columns', field: row.field, headers: slots.filter((h) => h !== '') })
  }

  const needsOrder = result.needsDateOrder && profile.formats.dateOrder === undefined
  const dateColumn = DATE_FIELDS.map((f) => profile.columns[f]?.[0]).find((h) => h !== undefined)
  const sample = dateColumn === undefined ? undefined : sampleValues(table, dateColumn, 20).find((v) => dateReadings(v) !== null)
  const readings = sample === undefined ? null : dateReadings(sample)
  const needsType = kind === 'cases' && (profile.columns.workType ?? []).length === 0

  return (
    <div className="stack">
      <h2 className="step-heading" tabIndex={-1} data-step-heading>{t('import.columns.heading')}</h2>
      <p className="muted">{t('import.columns.help')}</p>

      {needsOrder && (
        <fieldset className="kinds">
          <legend>{sample !== undefined ? t('import.dates.legendSample', { sample }) : t('import.dates.legend')}</legend>
          <label>
            <input type="radio" name="order" onChange={() => dispatch({ type: 'dateOrder', order: 'dmy' })} />
            <span>{readings === null ? t('import.dates.dmyGeneric') : t('import.dates.dmy', { date: readings.dmy })}</span>
          </label>
          <label>
            <input type="radio" name="order" onChange={() => dispatch({ type: 'dateOrder', order: 'mdy' })} />
            <span>{readings === null ? t('import.dates.mdyGeneric') : t('import.dates.mdy', { date: readings.mdy })}</span>
          </label>
        </fieldset>
      )}

      {needsType && (
        <label className="field card">
          <span className="label">{t('import.noType')}</span>
          <select value={profile.singleWorkType ?? ''} onChange={(e) => dispatch({ type: 'singleWorkType', name: e.target.value === '' ? null : e.target.value })}>
            <option value="">{t('import.chooseType')}</option>
            {workspace.site.workTypes.map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
          </select>
        </label>
      )}

      {GROUPS.map((g) => {
        const list = rows.filter((r) => r.level === g.level)
        if (list.length === 0) return null
        return (
          <section key={g.level} className="stack-tight" aria-label={t(g.title)}>
            <h3 className="group-title">{t(g.title)}</h3>
            {kind === 'cases' && g.level === 'recommended' && (
              <p className="muted small">{t('import.placeHint')}</p>
            )}
            {list.map((row) => {
              const slots = MANY.includes(row.field) ? [...row.chosen, ''] : [row.chosen[0] ?? '']
              const sug = row.suggestion
              const matches = sug !== null && row.chosen[0] === sug.columns[0]
              return (
                <div key={row.field} className="card fieldrow">
                  <div className="fieldrow-head full">
                    <span className="label"><b>{row.label}</b></span>
                    <span className="badge">{t(LEVEL_TEXT[row.level])}</span>
                  </div>
                  <div className="stack-tight">
                    {slots.map((value, i) => (
                      <label key={i} className="field">
                        <span className="visually-hidden">{i === 0 ? row.label : t('import.anotherColumn', { label: row.label })}</span>
                        <select value={value} onChange={(e) => setField(row, i, e.target.value)}>
                          <option value="">{i === 0 ? t('import.notInFile') : t('import.addColumn')}</option>
                          {table.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                  <div className="stack-tight">
                    {matches && sug !== null && (
                      <span>
                        <span className={sug.confidence >= 0.8 ? 'badge badge-ok' : 'badge badge-warn'}>{sug.confidence >= 0.8 ? t('import.looksRight') : t('import.checkThis')}</span>{' '}
                        <span className="muted small">{sug.reason}</span>
                      </span>
                    )}
                    {row.personal && <span className="muted small">{t('import.personal')}</span>}
                    {row.samples[0] !== undefined && row.samples[0].length > 0 && <span className="samples">{t('import.sample', { values: row.samples[0].join(', ') })}</span>}
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
