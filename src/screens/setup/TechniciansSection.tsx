import { useState } from 'react'
import { formatNumber, t } from '../../i18n'
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
      <h2 id="set-techs" className="step-heading">{t('setup.techs.title', { n: formatNumber(technicians.length) })}</h2>
      <p className="muted small">{t('setup.techs.help')}</p>
      {technicians.length === 0 && <p className="muted">{t('setup.techs.none')}</p>}
      <ul className="stack">
        {technicians.map((tech) => {
          const edit = (patch: Parameters<typeof act.updateTechnician>[2]) => run((x) => act.updateTechnician(x, tech.name, patch))
          return (
            <li key={tech.name} className="card stack-tight">
              <div className="fieldrow-head">
                <b>{tech.name}</b>
                <label className="switch">
                  <input type="checkbox" role="switch" checked={tech.active} aria-label={t('board.switchAria', { name: tech.name })} onChange={() => update((x) => act.toggleTechnician(x, tech.name))} />
                  <span className="track" aria-hidden="true" />
                  <span className="switch-text">{tech.active ? t('data.active') : t('data.off')}</span>
                </label>
              </div>
              <fieldset className="kinds">
                <legend>{t('setup.techs.skills')}</legend>
                <div className="days-off">
                  {skills.map((k) => (
                    <label key={k}>
                      <input type="checkbox" checked={tech.skills.includes(k)} onChange={(e) => edit({ skills: e.target.checked ? [...tech.skills, k] : tech.skills.filter((x) => x !== k) })} />
                      <span>{k}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid2">
                <DateField label={t('setup.techs.leaveFrom')} value={tech.leaveFrom} onCommit={(v) => edit({ leaveFrom: v })} />
                <DateField label={t('setup.techs.leaveUntil')} value={tech.leaveTo} onCommit={(v) => edit({ leaveTo: v })} />
                <SelectField label={t('setup.techs.startsAt')} value={tech.startPlace ?? ''} options={placeNames} blank={t('setup.techs.base')} onChange={(v) => edit({ startPlace: v === '' ? undefined : v })} />
                <SelectField label={t('setup.techs.endsAt')} value={tech.endPlace ?? ''} options={placeNames} blank={t('setup.techs.base')} onChange={(v) => edit({ endPlace: v === '' ? undefined : v })} />
                <TimeField label={t('setup.techs.dayStart')} minutes={tech.shiftStart} allowEmpty onCommit={(v) => edit({ shiftStart: v })} help={t('setup.techs.dayStartHelp')} />
                <NumberField label={t('setup.techs.hours')} value={tech.shiftHours ?? 0} onCommit={(v) => edit({ shiftHours: v === 0 ? undefined : v })} help={t('setup.techs.hoursHelp')} />
              </div>
              <div className="row">
                {confirm === tech.name ? (
                  <>
                    <button type="button" className="btn btn-primary" onClick={() => { update((x) => act.removeTechnician(x, tech.name)); setConfirm(null) }}>{t('setup.techs.removeYes', { name: tech.name })}</button>
                    <button type="button" className="btn" onClick={() => setConfirm(null)}>{t('setup.techs.keep')}</button>
                  </>
                ) : (
                  <button type="button" className="btn" onClick={() => setConfirm(tech.name)}>{t('setup.removeName', { name: tech.name })}</button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="card stack-tight">
        <label className="field"><span className="label">{t('setup.techs.new')}</span><input type="text" value={draft.name} onChange={(e) => { clear(); setDraft({ ...draft, name: e.target.value }) }} /></label>
        <fieldset className="kinds">
          <legend>{t('setup.techs.skills')}</legend>
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
          <button type="button" className="btn btn-primary" onClick={() => { run((x) => act.addTechnician(x, draft)); if (draft.name.trim() !== '') setDraft({ name: '', skills: [] }) }}>{t('setup.techs.add')}</button>
        </div>
      </div>
      <Refusal error={error} />
    </section>
  )
}
