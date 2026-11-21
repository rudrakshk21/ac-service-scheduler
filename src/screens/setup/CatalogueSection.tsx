import { useState } from 'react'
import { useWorkspace } from '../../workspace/useWorkspace'
import { NumberField, Refusal, SelectField, TextField } from './fields'
import * as act from './setupActions'
import { useAction } from './useAction'

export function WorkTypesSection() {
  const { workspace } = useWorkspace()
  const { run, error, clear } = useAction()
  const { workTypes, skills } = workspace.site
  const [draft, setDraft] = useState({ name: '', minutes: '60', limit: '5', skill: '' })
  const skillOf = (i: number) => skills[i] ?? ''
  const add = () => {
    run((w) => act.addWorkType(w, { name: draft.name, serviceMin: Number(draft.minutes), dailyCeiling: Number(draft.limit), skill: draft.skill || skills[0] }))
    if (draft.name.trim() !== '') setDraft((d) => ({ ...d, name: '' }))
  }
  return (
    <section className="card stack" aria-labelledby="set-types">
      <h2 id="set-types" className="step-heading">Work types</h2>
      <p className="muted small">Each kind of visit, how long it takes, how many a technician can do in a day, and the skill it needs.</p>
      <ul className="stack-tight">
        {workTypes.map((w, i) => (
          <li key={w.name} className="card editrow">
            <TextField label={`Name of work type ${i + 1}`} hideLabel value={w.name} onCommit={(v) => run((x) => act.renameWorkType(x, w.name, v))} />
            <NumberField label={`${w.name}: visit minutes`} value={w.serviceMin} onCommit={(v) => run((x) => act.updateWorkType(x, w.name, { serviceMin: v }))} help="Visit minutes" />
            <NumberField label={`${w.name}: most per technician per day`} value={w.dailyCeiling} onCommit={(v) => run((x) => act.updateWorkType(x, w.name, { dailyCeiling: v }))} help="Most per day" />
            <SelectField label={`${w.name}: skill needed`} value={skillOf(w.requiredSkill)} options={skills} onChange={(v) => run((x) => act.updateWorkType(x, w.name, { skill: v }))} help="Skill needed" />
            <button type="button" className="btn" onClick={() => run((x) => act.removeWorkType(x, w.name))} aria-label={`Remove ${w.name}`}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="card editrow">
        <label className="field"><span className="label">New work type</span><input type="text" value={draft.name} onChange={(e) => { clear(); setDraft({ ...draft, name: e.target.value }) }} placeholder="For example Gas refill" /></label>
        <label className="field"><span className="label">Visit minutes</span><input type="number" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value })} /></label>
        <label className="field"><span className="label">Most per day</span><input type="number" value={draft.limit} onChange={(e) => setDraft({ ...draft, limit: e.target.value })} /></label>
        <label className="field"><span className="label">Skill needed</span>
          <select value={draft.skill || skills[0]} onChange={(e) => setDraft({ ...draft, skill: e.target.value })}>{skills.map((k) => <option key={k} value={k}>{k}</option>)}</select>
        </label>
        <button type="button" className="btn btn-primary" onClick={add}>Add work type</button>
      </div>
      <Refusal error={error} />
    </section>
  )
}

export function SkillsSection() {
  const { workspace } = useWorkspace()
  const { run, error, clear } = useAction()
  const [name, setName] = useState('')
  return (
    <section className="card stack" aria-labelledby="set-skills">
      <h2 id="set-skills" className="step-heading">Skills</h2>
      <p className="muted small">What technicians are approved to do. A work type needs one skill.</p>
      <ul className="stack-tight">
        {workspace.site.skills.map((k, i) => (
          <li key={k} className="card editrow tight">
            <TextField label={`Name of skill ${i + 1}`} hideLabel value={k} onCommit={(v) => run((x) => act.renameSkill(x, k, v))} />
            <button type="button" className="btn" onClick={() => run((x) => act.removeSkill(x, k))} aria-label={`Remove ${k}`}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="card editrow tight">
        <label className="field"><span className="label">New skill</span><input type="text" value={name} onChange={(e) => { clear(); setName(e.target.value) }} /></label>
        <button type="button" className="btn btn-primary" onClick={() => { run((x) => act.addSkill(x, name)); if (name.trim() !== '') setName('') }}>Add skill</button>
      </div>
      <Refusal error={error} />
    </section>
  )
}

export function LevelsSection() {
  const { workspace } = useWorkspace()
  const { run, error, clear } = useAction()
  const [draft, setDraft] = useState({ name: '', weight: '100' })
  const levels = workspace.site.priorityLevels
  return (
    <section className="card stack" aria-labelledby="set-levels">
      <h2 id="set-levels" className="step-heading">Priority levels</h2>
      <p className="muted small">Lowest first. A higher weight plans a case sooner. The weight is added to how long the case has waited.</p>
      <ul className="stack-tight">
        {levels.map((l, i) => (
          <li key={l.name} className="card editrow">
            <TextField label={`Name of level ${i + 1}`} hideLabel value={l.name} onCommit={(v) => run((x) => act.renameLevel(x, l.name, v))} />
            <NumberField label={`${l.name}: weight`} value={l.weight} onCommit={(v) => run((x) => act.updateLevel(x, l.name, { weight: v }))} help="Weight" />
            <div className="row">
              <button type="button" className="btn" disabled={i === 0} onClick={() => run((x) => act.moveLevel(x, l.name, -1))} aria-label={`Move ${l.name} up`}>Up</button>
              <button type="button" className="btn" disabled={i === levels.length - 1} onClick={() => run((x) => act.moveLevel(x, l.name, 1))} aria-label={`Move ${l.name} down`}>Down</button>
              <button type="button" className="btn" onClick={() => run((x) => act.removeLevel(x, l.name))} aria-label={`Remove ${l.name}`}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="card editrow">
        <label className="field"><span className="label">New level</span><input type="text" value={draft.name} onChange={(e) => { clear(); setDraft({ ...draft, name: e.target.value }) }} /></label>
        <label className="field"><span className="label">Weight</span><input type="number" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value })} /></label>
        <button type="button" className="btn btn-primary" onClick={() => { run((x) => act.addLevel(x, draft.name, Number(draft.weight))); if (draft.name.trim() !== '') setDraft({ ...draft, name: '' }) }}>Add level</button>
      </div>
      <Refusal error={error} />
    </section>
  )
}
