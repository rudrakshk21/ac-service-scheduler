import { useMemo, useState } from 'react'
import { Board } from './Board'
import { useDemoPlan, type ChangeNote } from './useDemoPlan'
import { daysWithVisits, summarise } from './viewModel'
import './demo.css'

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

function changeText(c: ChangeNote): string {
  const moved = c.moved === 0 ? 'No case moved.' : `${plural(c.moved, 'case', 'cases')} moved.`
  return `${c.techName} switched ${c.switchedOn ? 'on' : 'off'}. ${moved}`
}

export function DemoPage() {
  const { input, result, change, busy, error, toggleTechnician } = useDemoPlan()
  const [picked, setPicked] = useState<number | null>(null)
  const days = useMemo(() => (result === null ? [] : daysWithVisits(result)), [result])
  const summary = useMemo(() => (input && result ? summarise(input, result) : null), [input, result])
  const day = days.find((d) => d.day === picked)?.day ?? days[0]?.day

  return (
    <div className="page">
      <header className="top">
        <div>
          <h1>AC Service Scheduler</h1>
          {summary !== null ? (
            <p className="lede">
              {plural(summary.scheduled, 'case', 'cases')} scheduled over {plural(summary.days, 'working day', 'working days')}
              {summary.unscheduled > 0 && `, ${summary.unscheduled} not scheduled`}. {summary.techniciansUsed} of{' '}
              {summary.techniciansTotal} technicians work. {summary.travelHours} hours of driving, {summary.onSiteHours} hours on
              site.
            </p>
          ) : (
            <p className="lede">{error === null ? 'Planning the demo cases…' : ''}</p>
          )}
        </div>
        <p className="note">Demo with invented data. Nothing here is real.</p>
      </header>

      {error !== null && (
        <p className="error" role="alert">
          The plan could not be made. {error}
        </p>
      )}

      {input !== null && result !== null && day !== undefined && (
        <>
          <div className="days" role="group" aria-label="Choose a day">
            {days.map((d) => (
              <button
                key={d.day}
                type="button"
                className="day"
                aria-pressed={d.day === day}
                onClick={() => setPicked(d.day)}
              >
                <span className="day-name">{d.weekday}</span>
                <span className="day-date">{d.date}</span>
                <span className="day-count">{plural(d.visits, 'visit', 'visits')}</span>
              </button>
            ))}
          </div>

          <ul className="legend" aria-label="Colours">
            {input.workTypes.map((w, i) => (
              <li key={w.name}>
                <span className={`swatch w${i % 6}`} aria-hidden="true" />
                {w.name}
              </li>
            ))}
            <li>
              <span className="swatch travel" aria-hidden="true" />
              Driving
            </li>
            <li>
              <span className="swatch break" aria-hidden="true" />
              Break
            </li>
          </ul>

          <p className="change" role="status" aria-live="polite">
            {change !== null ? changeText(change) : 'Switch a technician off to see the plan change.'}
          </p>

          <Board input={input} result={result} day={day} change={change} busy={busy} onToggle={toggleTechnician} />
        </>
      )}
    </div>
  )
}
