import { useState } from 'react'
import { useWorkspace } from '../../workspace/useWorkspace'
import { NumberField, Refusal, TextField, TimeField } from './fields'
import { setBase, setSettings, setSiteName } from './setupActions'
import { useAction } from './useAction'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function SiteSection() {
  const { workspace } = useWorkspace()
  const { run, error } = useAction()
  const [where, setWhere] = useState<string | null>(null)
  const s = workspace.site.settings

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setWhere('This browser cannot tell where you are.')
      return
    }
    setWhere('Asking for your location…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setWhere(null)
        run((w) => setBase(w, Math.round(pos.coords.latitude * 1e5) / 1e5, Math.round(pos.coords.longitude * 1e5) / 1e5))
      },
      () => setWhere('Your location was not shared. Type the latitude and longitude instead.'),
    )
  }

  return (
    <section className="card stack" aria-labelledby="set-site">
      <h2 id="set-site" className="step-heading">Your centre</h2>
      <TextField label="Name of the centre" value={workspace.site.name} onCommit={(v) => run((w) => setSiteName(w, v))} />
      <div className="stack-tight">
        <b>Base location</b>
        <p className="muted small">Where the technicians start and end the day, unless a technician has a place of their own.</p>
        <div className="grid2">
          <NumberField label="Latitude" value={s.baseLat} onCommit={(v) => run((w) => setBase(w, v, w.site.settings.baseLon))} />
          <NumberField label="Longitude" value={s.baseLon} onCommit={(v) => run((w) => setBase(w, w.site.settings.baseLat, v))} />
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={useMyLocation}>Use my location</button>
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
      <h2 id="set-rules" className="step-heading">Working rules</h2>
      <p className="muted small">The starting values suit most centres. Change them to match yours.</p>
      <div className="grid2">
        <NumberField label="Average speed (km/h)" value={s.speedKmh} onCommit={(v) => set({ speedKmh: v })} help="Used to turn distance into driving time." />
        <NumberField label="Road factor" value={s.roadFactor} onCommit={(v) => set({ roadFactor: v })} help="Road distance divided by straight-line distance, usually 1.2 to 1.5." />
        <NumberField label="Time between visits in one area (minutes)" value={s.sameAreaHopMin} onCommit={(v) => set({ sameAreaHopMin: v })} />
        <NumberField label="Longest trip (km)" value={s.maxKm} onCommit={(v) => set({ maxKm: v })} />
        <TimeField label="The day starts at" minutes={s.dayStartMin} onCommit={(v) => v !== undefined && set({ dayStartMin: v })} />
        <TimeField label="Lunch starts at" minutes={s.lunchStartMin} onCommit={(v) => v !== undefined && set({ lunchStartMin: v })} />
        <NumberField label="Working hours per day" value={Math.round((s.usableMin / 60) * 100) / 100} onCommit={(v) => set({ usableMin: Math.round(v * 60) })} help="Driving and visits, not counting the break." />
        <NumberField label="Break (minutes)" value={s.breakMin} onCommit={(v) => set({ breakMin: v })} />
        <NumberField label="Plan this many working days ahead" value={s.horizonDays} step="1" onCommit={(v) => set({ horizonDays: v })} />
      </div>
      <fieldset className="kinds">
        <legend>Days nobody works</legend>
        <div className="days-off">
          {DAYS.map((name, i) => (
            <label key={name}>
              <input
                type="checkbox" checked={rest.has(i)}
                onChange={(e) => set({ restWeekdays: e.target.checked ? [...rest, i].sort() : [...rest].filter((d) => d !== i) })}
              />
              <span>{name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <h3 className="group-title">How the planner chooses</h3>
      <div className="grid2">
        <NumberField label="Weight of waiting time" value={s.ageWeight} onCommit={(v) => set({ ageWeight: v })} help="Points per day a case has waited. Higher plans old cases sooner." />
        <NumberField label="Weight of even workloads" value={s.balanceWeight} onCommit={(v) => set({ balanceWeight: v })} help="Higher spreads visits more evenly between technicians." />
        <NumberField label="Weight of due dates" value={s.dueWeight ?? 8} onCommit={(v) => set({ dueWeight: v })} help="Points per day once a due date is near." />
        <NumberField label="Days before a due date when urgency grows" value={s.urgencyWindowDays ?? 5} onCommit={(v) => set({ urgencyWindowDays: v })} />
      </div>
      <Refusal error={error} />
    </section>
  )
}
