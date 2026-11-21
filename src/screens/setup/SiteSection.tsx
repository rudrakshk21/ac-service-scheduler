import { useState } from 'react'
import { t, type MessageKey } from '../../i18n'
import { useWorkspace } from '../../workspace/useWorkspace'
import { NumberField, Refusal, TextField, TimeField } from './fields'
import { setBase, setSettings, setSiteName } from './setupActions'
import { useAction } from './useAction'

const DAYS = [0, 1, 2, 3, 4, 5, 6]

export function SiteSection() {
  const { workspace } = useWorkspace()
  const { run, error } = useAction()
  const [where, setWhere] = useState<string | null>(null)
  const s = workspace.site.settings

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setWhere(t('setup.site.noGeo'))
      return
    }
    setWhere(t('setup.site.asking'))
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setWhere(null)
        run((w) => setBase(w, Math.round(pos.coords.latitude * 1e5) / 1e5, Math.round(pos.coords.longitude * 1e5) / 1e5))
      },
      () => setWhere(t('setup.site.denied')),
    )
  }

  return (
    <section className="card stack" aria-labelledby="set-site">
      <h2 id="set-site" className="step-heading">{t('setup.site.title')}</h2>
      <TextField label={t('setup.site.name')} value={workspace.site.name} onCommit={(v) => run((w) => setSiteName(w, v))} />
      <div className="stack-tight">
        <b>{t('setup.site.base')}</b>
        <p className="muted small">{t('setup.site.baseHelp')}</p>
        <div className="grid2">
          <NumberField label={t('setup.site.lat')} value={s.baseLat} onCommit={(v) => run((w) => setBase(w, v, w.site.settings.baseLon))} />
          <NumberField label={t('setup.site.lon')} value={s.baseLon} onCommit={(v) => run((w) => setBase(w, w.site.settings.baseLat, v))} />
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={useMyLocation}>{t('setup.site.useLocation')}</button>
          {where !== null && <span className="muted small" role="status">{where}</span>}
        </div>
      </div>
      <Refusal error={error} />
    </section>
  )
}

export function RulesSection() {
  const { workspace } = useWorkspace()
  const { run, error } = useAction()
  const s = workspace.site.settings
  const set = (patch: Parameters<typeof setSettings>[1]) => run((w) => setSettings(w, patch))
  const rest = new Set(s.restWeekdays)

  return (
    <section className="card stack" aria-labelledby="set-rules">
      <h2 id="set-rules" className="step-heading">{t('setup.rules.title')}</h2>
      <p className="muted small">{t('setup.rules.help')}</p>
      <div className="grid2">
        <NumberField label={t('setup.rules.speed')} value={s.speedKmh} onCommit={(v) => set({ speedKmh: v })} help={t('setup.rules.speedHelp')} />
        <NumberField label={t('setup.rules.road')} value={s.roadFactor} onCommit={(v) => set({ roadFactor: v })} help={t('setup.rules.roadHelp')} />
        <NumberField label={t('setup.rules.hop')} value={s.sameAreaHopMin} onCommit={(v) => set({ sameAreaHopMin: v })} />
        <NumberField label={t('setup.rules.maxKm')} value={s.maxKm} onCommit={(v) => set({ maxKm: v })} help={t('setup.rules.maxKmHelp')} />
        <TimeField label={t('setup.rules.dayStart')} minutes={s.dayStartMin} onCommit={(v) => v !== undefined && set({ dayStartMin: v })} />
        <TimeField label={t('setup.rules.lunch')} minutes={s.lunchStartMin} onCommit={(v) => v !== undefined && set({ lunchStartMin: v })} />
        <NumberField label={t('setup.rules.hours')} value={Math.round((s.usableMin / 60) * 100) / 100} onCommit={(v) => set({ usableMin: Math.round(v * 60) })} help={t('setup.rules.hoursHelp')} />
        <NumberField label={t('setup.rules.break')} value={s.breakMin} onCommit={(v) => set({ breakMin: v })} />
        <NumberField label={t('setup.rules.horizon')} value={s.horizonDays} step="1" onCommit={(v) => set({ horizonDays: v })} />
      </div>
      <fieldset className="kinds">
        <legend>{t('setup.rules.restDays')}</legend>
        <div className="days-off">
          {DAYS.map((i) => (
            <label key={i}>
              <input
                type="checkbox" checked={rest.has(i)}
                onChange={(e) => set({ restWeekdays: e.target.checked ? [...rest, i].sort() : [...rest].filter((d) => d !== i) })}
              />
              <span>{t(`weekday.${i}` as MessageKey)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <h3 className="group-title">{t('setup.rules.choose')}</h3>
      <div className="grid2">
        <NumberField label={t('setup.rules.ageWeight')} value={s.ageWeight} onCommit={(v) => set({ ageWeight: v })} help={t('setup.rules.ageWeightHelp')} />
        <NumberField label={t('setup.rules.balanceWeight')} value={s.balanceWeight} onCommit={(v) => set({ balanceWeight: v })} help={t('setup.rules.balanceWeightHelp')} />
        <NumberField label={t('setup.rules.dueWeight')} value={s.dueWeight ?? 8} onCommit={(v) => set({ dueWeight: v })} help={t('setup.rules.dueWeightHelp')} />
        <NumberField label={t('setup.rules.urgency')} value={s.urgencyWindowDays ?? 5} onCommit={(v) => set({ urgencyWindowDays: v })} />
      </div>
      <Refusal error={error} />
    </section>
  )
}
