import { useState } from 'react'
import { useWorkspace } from '../../workspace/useWorkspace'
import { Refusal } from './fields'
import { addHoliday, removeHoliday } from './setupActions'
import { useAction } from './useAction'

export function HolidaysSection() {
  const { workspace, update } = useWorkspace()
  const { run, error, clear } = useAction()
  const [date, setDate] = useState('')
  return (
    <section className="card stack" aria-labelledby="set-holidays">
      <h2 id="set-holidays" className="step-heading">Holidays ({workspace.holidays.length})</h2>
      <p className="muted small">Days nobody works, besides the weekly days off. The planner skips them.</p>
      <ul className="rows">
        {workspace.holidays.map((d) => (
          <li key={d}>
            <span>{d}</span>
            <button type="button" className="btn" onClick={() => update((w) => removeHoliday(w, d))} aria-label={`Remove the holiday ${d}`}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="card editrow tight">
        <label className="field"><span className="label">Add a holiday</span><input type="date" value={date} onChange={(e) => { clear(); setDate(e.target.value) }} /></label>
        <button type="button" className="btn btn-primary" onClick={() => { run((w) => addHoliday(w, date)); setDate('') }}>Add holiday</button>
      </div>
      <Refusal error={error} />
    </section>
  )
}
