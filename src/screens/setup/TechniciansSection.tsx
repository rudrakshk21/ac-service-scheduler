import { useState } from 'react'
import { useWorkspace } from '../../workspace/useWorkspace'
import { DateField, NumberField, Refusal, SelectField, TimeField } from './fields'
import * as act from './setupActions'
import { useAction } from './useAction'

export function TechniciansSection() {
  const { workspace, update } = useWorkspace()
  const { run, error, clear } = useAction()
  const { technicians } = workspace
  const { skills, places } = workspace.site
  const [draft, setDraft] = useState({ name: '', skills: [] as string[] })
  const [confirm, setConfirm] = useState<string | null>(null)
  const placeNames = places.map((p) => p.name)

  return (
    <section className="card stack" aria-labelledby="set-techs">
      <h2 id="set-techs" className="step-heading">Technicians ({technicians.length})</h2>
      <p className="muted small">Who does the visits. Leave a field empty to use the centre's own value. You can also import a file of technicians.</p>
      {technicians.length === 0 && <p className="muted">No technicians yet. Import a file or add one below.</p>}
      <ul className="stack">
        {technicians.map((t) => {
          const edit = (patch: Parameters<typeof act.updateTechnician>[2]) => run((x) => act.updateTechnician(x, t.name, patch))
          return (
            <li key={t.name} className="card stack-tight">
              <div className="fieldrow-head">
                <b>{t.name}</b>
                <label className="switch">
                  <input type="checkbox" role="switch" checked={t.active} aria-label={`${t.name} active`} onChange={() => update((x) => act.toggleTechnician(x, t.name))} />
                  <span className="track" aria-hidden="true" />
                  <span className="switch-text">{t.active ? 'Active' : 'Switched off'}</span>
                </label>
              </div>
              <fieldset className="kinds">
                <legend>Skills</legend>
                <div className="days-off">
                  {skills.map((k) => (
                    <label key={k}>
                      <input type="checkbox" checked={t.skills.includes(k)} onChange={(e) => edit({ skills: e.target.checked ? [...t.skills, k] : t.skills.filter((x) => x !== k) })} />
                      <span>{k}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid2">
                <DateField label="On leave from" value={t.leaveFrom} onCommit={(v) => edit({ leaveFrom: v })} />
                <DateField label="On leave until" value={t.leaveTo} onCommit={(v) => edit({ leaveTo: v })} />
                <SelectField label="Starts the day at" value={t.startPlace ?? ''} options={placeNames} blank="The base" onChange={(v) => edit({ startPlace: v === '' ? undefined : v })} />
                <SelectField label="Ends the day at" value={t.endPlace ?? ''} options={placeNames} blank="The base" onChange={(v) => edit({ endPlace: v === '' ? undefined : v })} />
                <TimeField label="Day starts at" minutes={t.shiftStart} allowEmpty onCommit={(v) => edit({ shiftStart: v })} help="Empty: the centre's time." />
                <NumberField label="Hours on shift" value={t.shiftHours ?? 0} onCommit={(v) => edit({ shiftHours: v === 0 ? undefined : v })} help="0: the centre's hours." />
              </div>
              <div className="row">
                {confirm === t.name ? (
                  <>
                    <button type="button" className="btn btn-primary" onClick={() => { update((x) => act.removeTechnician(x, t.name)); setConfirm(null) }}>Yes, remove {t.name}</button>
                    <button type="button" className="btn" onClick={() => setConfirm(null)}>Keep</button>
                  </>
                ) : (
                  <button type="button" className="btn" onClick={() => setConfirm(t.name)}>Remove {t.name}</button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="card stack-tight">
        <label className="field"><span className="label">New technician</span><input type="text" value={draft.name} onChange={(e) => { clear(); setDraft({ ...draft, name: e.target.value }) }} /></label>
        <fieldset className="kinds">
          <legend>Skills</legend>
          <div className="days-off">
            {skills.map((k) => (
              <label key={k}>
                <input type="checkbox" checked={draft.skills.includes(k)} onChange={(e) => setDraft({ ...draft, skills: e.target.checked ? [...draft.skills, k] : draft.skills.filter((x) => x !== k) })} />
                <span>{k}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => { run((x) => act.addTechnician(x, draft)); if (draft.name.trim() !== '') setDraft({ name: '', skills: [] }) }}>Add technician</button>
        </div>
      </div>
      <Refusal error={error} />
    </section>
  )
}
