import { useState } from 'react'
import { formatNumber, t } from '../../i18n'
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
      <h2 id="set-types" className="step-heading">{t('setup.types.title')}</h2>
      <p className="muted small">{t('setup.types.help')}</p>
      <ul className="stack-tight">
        {workTypes.map((w, i) => (
          <li key={w.name} className="card editrow">
            <TextField label={t('setup.types.nameOf', { n: formatNumber(i + 1) })} hideLabel value={w.name} onCommit={(v) => run((x) => act.renameWorkType(x, w.name, v))} />
            <NumberField label={t('setup.types.minutesOf', { name: w.name })} value={w.serviceMin} onCommit={(v) => run((x) => act.updateWorkType(x, w.name, { serviceMin: v }))} help={t('setup.types.minutes')} />
            <NumberField label={t('setup.types.mostOf', { name: w.name })} value={w.dailyCeiling} onCommit={(v) => run((x) => act.updateWorkType(x, w.name, { dailyCeiling: v }))} help={t('setup.types.most')} />
            <SelectField label={t('setup.types.skillOf', { name: w.name })} value={skillOf(w.requiredSkill)} options={skills} onChange={(v) => run((x) => act.updateWorkType(x, w.name, { skill: v }))} help={t('setup.types.skill')} />
            <button type="button" className="btn" onClick={() => run((x) => act.removeWorkType(x, w.name))} aria-label={t('setup.removeName', { name: w.name })}>{t('setup.remove')}</button>
          </li>
        ))}
      </ul>
      <div className="card editrow">
        <label className="field"><span className="label">{t('setup.types.new')}</span><input type="text" value={draft.name} onChange={(e) => { clear(); setDraft({ ...draft, name: e.target.value }) }} placeholder={t('setup.types.example')} /></label>
        <label className="field"><span className="label">{t('setup.types.minutes')}</span><input type="number" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value })} /></label>
        <label className="field"><span className="label">{t('setup.types.most')}</span><input type="number" value={draft.limit} onChange={(e) => setDraft({ ...draft, limit: e.target.value })} /></label>
        <label className="field"><span className="label">{t('setup.types.skill')}</span>
          <select value={draft.skill || skills[0]} onChange={(e) => setDraft({ ...draft, skill: e.target.value })}>{skills.map((k) => <option key={k} value={k}>{k}</option>)}</select>
        </label>
        <button type="button" className="btn btn-primary" onClick={add}>{t('setup.types.add')}</button>
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
      <h2 id="set-skills" className="step-heading">{t('setup.skills.title')}</h2>
      <p className="muted small">{t('setup.skills.help')}</p>
      <ul className="stack-tight">
        {workspace.site.skills.map((k, i) => (
          <li key={k} className="card editrow tight">
            <TextField label={t('setup.skills.nameOf', { n: formatNumber(i + 1) })} hideLabel value={k} onCommit={(v) => run((x) => act.renameSkill(x, k, v))} />
            <button type="button" className="btn" onClick={() => run((x) => act.removeSkill(x, k))} aria-label={t('setup.removeName', { name: k })}>{t('setup.remove')}</button>
          </li>
        ))}
      </ul>
      <div className="card editrow tight">
        <label className="field"><span className="label">{t('setup.skills.new')}</span><input type="text" value={name} onChange={(e) => { clear(); setName(e.target.value) }} /></label>
        <button type="button" className="btn btn-primary" onClick={() => { run((x) => act.addSkill(x, name)); if (name.trim() !== '') setName('') }}>{t('setup.skills.add')}</button>
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
      <h2 id="set-levels" className="step-heading">{t('setup.levels.title')}</h2>
      <p className="muted small">{t('setup.levels.help')}</p>
      <ul className="stack-tight">
        {levels.map((l, i) => (
          <li key={l.name} className="card editrow">
            <TextField label={t('setup.levels.nameOf', { n: formatNumber(i + 1) })} hideLabel value={l.name} onCommit={(v) => run((x) => act.renameLevel(x, l.name, v))} />
            <NumberField label={t('setup.levels.weightOf', { name: l.name })} value={l.weight} onCommit={(v) => run((x) => act.updateLevel(x, l.name, { weight: v }))} help={t('setup.levels.weight')} />
            <div className="row">
              <button type="button" className="btn" disabled={i === 0} onClick={() => run((x) => act.moveLevel(x, l.name, -1))} aria-label={t('setup.levels.moveUp', { name: l.name })}>{t('setup.levels.up')}</button>
              <button type="button" className="btn" disabled={i === levels.length - 1} onClick={() => run((x) => act.moveLevel(x, l.name, 1))} aria-label={t('setup.levels.moveDown', { name: l.name })}>{t('setup.levels.down')}</button>
              <button type="button" className="btn" onClick={() => run((x) => act.removeLevel(x, l.name))} aria-label={t('setup.removeName', { name: l.name })}>{t('setup.remove')}</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="card editrow">
        <label className="field"><span className="label">{t('setup.levels.new')}</span><input type="text" value={draft.name} onChange={(e) => { clear(); setDraft({ ...draft, name: e.target.value }) }} /></label>
        <label className="field"><span className="label">{t('setup.levels.weight')}</span><input type="number" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value })} /></label>
        <button type="button" className="btn btn-primary" onClick={() => { run((x) => act.addLevel(x, draft.name, Number(draft.weight))); if (draft.name.trim() !== '') setDraft({ ...draft, name: '' }) }}>{t('setup.levels.add')}</button>
      </div>
      <Refusal error={error} />
    </section>
  )
}
