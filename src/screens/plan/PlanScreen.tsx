import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import type { ChangeNote } from '../../demo/useDemoPlan'
import { Board } from '../../demo/Board'
import { daysWithVisits, summarise } from '../../demo/viewModel'
import { useWorkspace } from '../../workspace/useWorkspace'
import { setBase, toggleTechnician } from '../setup/setupActions'
import { baseAdvice, nothingPlannedHint, prepare } from './planData'
import { usePlan, type SwitchNote } from './usePlan'
import '../../demo/demo.css'

const DemoPage = lazy(() => import('../../demo/DemoPage').then((m) => ({ default: m.DemoPage })))

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

function changeText(c: ChangeNote): string {
  const moved = c.moved === 0 ? 'No case moved.' : `${plural(c.moved, 'case', 'cases')} moved.`
  return `${c.techName} switched ${c.switchedOn ? 'on' : 'off'}. ${moved}`
}

export default function PlanScreen() {
  const { workspace, update } = useWorkspace()
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [demo, setDemo] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const note = useRef<SwitchNote | null>(null)
  const prepared = useMemo(() => prepare(workspace, today), [workspace, today])
  const advice = useMemo(() => baseAdvice(workspace), [workspace])
  const { input, result, busy, error, change } = usePlan(prepared.ok ? prepared.input : null, note)
  const days = useMemo(() => (result === null ? [] : daysWithVisits(result)), [result])
  const summary = useMemo(() => (input !== null && result !== null ? summarise(input, result) : null), [input, result])
  const day = days.find((d) => d.day === picked)?.day ?? days[0]?.day

  if (demo) {
    return (
      <div className="stack">
        <div className="screen" style={{ paddingBottom: 0 }}>
          <button type="button" className="btn" onClick={() => setDemo(false)}>Back to my plan</button>
        </div>
        <Suspense fallback={<p className="screen muted">Loading…</p>}><DemoPage /></Suspense>
      </div>
    )
  }

  if (!prepared.ok) {
    return (
      <section className="screen">
        <h1 className="screen-title" tabIndex={-1}>Plan</h1>
        <div className="empty">
          <h2>{prepared.title}</h2>
          <p>{prepared.text}</p>
          <div className="row" style={{ marginTop: 16 }}>
            <a className="btn btn-primary" href={prepared.action.href}>{prepared.action.label}</a>
            <button type="button" className="btn" onClick={() => setDemo(true)}>See the demo with invented data</button>
          </div>
        </div>
      </section>
    )
  }

  const putBaseInMiddle = () => {
    if (advice === null) return
    update((w) => {
      const outcome = setBase(w, advice.lat, advice.lon)
      return outcome.ok ? outcome.workspace : w
    })
  }
  const onToggle = (i: number) => {
    const name = prepared.input.technicians[i].name
    const tech = workspace.technicians.find((t) => t.name === name)
    note.current = { techName: name, switchedOn: tech?.active !== true }
    update((w) => toggleTechnician(w, name))
  }
  const left = prepared.left
  const leftOut = left.hold + left.review + left.noPlace

  return (
    <div className="page">
      <header className="top">
        <div>
          <h1 tabIndex={-1}>Plan</h1>
          {summary !== null ? (
            <p className="lede">
              {plural(summary.scheduled, 'case', 'cases')} planned over {plural(summary.days, 'working day', 'working days')}
              {summary.unscheduled > 0 && `, ${summary.unscheduled} not planned`}. {summary.techniciansUsed} of {summary.techniciansTotal} technicians
              work. {summary.travelHours} hours of driving, {summary.onSiteHours} hours on site. Starting {prepared.planStart}.
            </p>
          ) : (
            <p className="lede">{error === null ? 'Planning…' : ''}</p>
          )}
        </div>
      </header>

      {error !== null && <p className="error" role="alert">The plan could not be made. {error}</p>}

      {advice !== null && (
        <div className="alert alert-note" role="status">
          <p>
            The base location of your centre is {advice.nearestKm} km from the nearest case, so no visit fits in a day.
            Put the base in the middle of your cases, or set it yourself in Set-up.
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-primary" onClick={putBaseInMiddle}>Put the base in the middle of my cases</button>
            <a className="btn" href="#/setup">Open set-up</a>
          </div>
        </div>
      )}

      {advice === null && summary !== null && summary.scheduled === 0 && (
        <p className="alert alert-note" role="status">{nothingPlannedHint(prepared.input)} <a href="#/setup">Open set-up</a></p>
      )}

      {input !== null && result !== null && day !== undefined && (
        <>
          <div className="days" role="group" aria-label="Choose a day">
            {days.map((d) => (
              <button key={d.day} type="button" className="day" aria-pressed={d.day === day} onClick={() => setPicked(d.day)}>
                <span className="day-name">{d.weekday}</span>
                <span className="day-date">{d.date}</span>
                <span className="day-count">{plural(d.visits, 'visit', 'visits')}</span>
              </button>
            ))}
          </div>

          <ul className="legend" aria-label="Colours">
            {input.workTypes.map((w, i) => (
              <li key={w.name}><span className={`swatch w${i % 6}`} aria-hidden="true" />{w.name}</li>
            ))}
            <li><span className="swatch travel" aria-hidden="true" />Driving</li>
            <li><span className="swatch break" aria-hidden="true" />Break</li>
          </ul>

          <p className="change" role="status" aria-live="polite">
            {change !== null ? changeText(change) : 'Switch a technician off to see the plan change.'}
          </p>

          <Board input={input} result={result} day={day} change={change} busy={busy} onToggle={onToggle} />
        </>
      )}

      {result !== null && result.unscheduled.length > 0 && (
        <section className="stack-tight" aria-label="Cases not planned" style={{ marginTop: 24 }}>
          <h2 className="step-heading">Not planned ({result.unscheduled.length})</h2>
          <ul className="issues">
            {result.unscheduled.slice(0, 20).map((u) => <li key={u.id}><b>{u.id}</b>: {u.reason}</li>)}
          </ul>
          {result.unscheduled.length > 20 && <p className="muted small">And {result.unscheduled.length - 20} more.</p>}
        </section>
      )}

      {leftOut > 0 && (
        <p className="muted" style={{ marginTop: 24 }}>
          Left out of the plan: {left.hold} on hold, {left.review} in review, {left.noPlace} without a known place. <a href="#/data">See the data</a>.
        </p>
      )}
    </div>
  )
}
