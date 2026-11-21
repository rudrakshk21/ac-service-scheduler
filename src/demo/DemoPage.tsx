import { useMemo, useState } from 'react'
import { formatNumber, t, tn } from '../i18n'
import { Board } from './Board'
import { changeText } from './changeText'
import { useDemoPlan } from './useDemoPlan'
import { daysWithVisits, summarise } from './viewModel'
import './demo.css'

const hours = (n: number): string => formatNumber(n, { minimumFractionDigits: 0, maximumFractionDigits: 1 })

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
          <h1>{t('app.name')}</h1>
          {summary !== null ? (
            <p className="lede">
              {t('demo.lede', {
                cases: tn('plan.cases', summary.scheduled),
                days: tn('plan.workingDays', summary.days),
                left: summary.unscheduled > 0 ? t('demo.left', { count: formatNumber(summary.unscheduled) }) : '',
                used: formatNumber(summary.techniciansUsed),
                total: formatNumber(summary.techniciansTotal),
                drive: hours(summary.travelHours),
                onsite: hours(summary.onSiteHours),
              })}
            </p>
          ) : (
            <p className="lede">{error === null ? t('demo.planning') : ''}</p>
          )}
        </div>
        <p className="note">{t('demo.note')}</p>
      </header>

      {error !== null && (
        <p className="error" role="alert">
          {t('plan.error', { error })}
        </p>
      )}

      {input !== null && result !== null && day !== undefined && (
        <>
          <div className="days" role="group" aria-label={t('plan.chooseDay')}>
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
                <span className="day-count">{tn('plan.visits', d.visits)}</span>
              </button>
            ))}
          </div>

          <ul className="legend" aria-label={t('plan.colours')}>
            {input.workTypes.map((w, i) => (
              <li key={w.name}>
                <span className={`swatch w${i % 6}`} aria-hidden="true" />
                {w.name}
              </li>
            ))}
            <li>
              <span className="swatch travel" aria-hidden="true" />
              {t('plan.driving')}
            </li>
            <li>
              <span className="swatch break" aria-hidden="true" />
              {t('plan.break')}
            </li>
          </ul>

          <p className="change" role="status" aria-live="polite">
            {change !== null ? changeText(change) : t('plan.switchHint')}
          </p>

          <Board input={input} result={result} day={day} change={change} busy={busy} onToggle={toggleTechnician} />
        </>
      )}
    </div>
  )
}
