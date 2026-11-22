import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Board } from '../../demo/Board'
import { changeText } from '../../demo/changeText'
import { daysWithVisits, summarise } from '../../demo/viewModel'
import { formatNumber, t, tn } from '../../i18n'
import { useWorkspace } from '../../workspace/useWorkspace'
import { setBase, toggleTechnician } from '../setup/setupActions'
import { baseAdvice, nothingPlannedHint, prepare, sizeNotice, TESTED_SIZE } from './planData'
import { DayMap } from './DayMap'
import { ReportsPanel } from './ReportsPanel'
import { ShareBar } from './ShareBar'
import { usePlan, type SwitchNote } from './usePlan'
import '../../demo/demo.css'

const DemoPage = lazy(() => import('../../demo/DemoPage').then((m) => ({ default: m.DemoPage })))

const hours = (n: number): string => formatNumber(n, { minimumFractionDigits: 0, maximumFractionDigits: 1 })

export default function PlanScreen() {
  const { workspace, update } = useWorkspace()
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [demo, setDemo] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const note = useRef<SwitchNote | null>(null)
  const prepared = useMemo(() => prepare(workspace, today), [workspace, today])
  const advice = useMemo(() => baseAdvice(workspace), [workspace])
  const large = useMemo(() => (prepared.ok ? sizeNotice(prepared.input) : null), [prepared])
  const { input, result, busy, error, change } = usePlan(prepared.ok ? prepared.input : null, note)
  const days = useMemo(() => (result === null ? [] : daysWithVisits(result)), [result])
  const summary = useMemo(() => (input !== null && result !== null ? summarise(input, result) : null), [input, result])
  const day = days.find((d) => d.day === picked)?.day ?? days[0]?.day

  if (demo) {
    return (
      <div className="stack">
        <div className="screen" style={{ paddingBottom: 0 }}>
          <button type="button" className="btn" onClick={() => setDemo(false)}>{t('plan.demoBack')}</button>
        </div>
        <Suspense fallback={<p className="screen muted">{t('common.loading')}</p>}><DemoPage /></Suspense>
      </div>
    )
  }

  if (!prepared.ok) {
    return (
      <section className="screen">
        <h1 className="screen-title" tabIndex={-1}>{t('plan.title')}</h1>
        <div className="empty">
          <h2>{prepared.title}</h2>
          <p>{prepared.text}</p>
          <div className="row" style={{ marginTop: 16 }}>
            <a className="btn btn-primary" href={prepared.action.href}>{prepared.action.label}</a>
            <a className="btn" href="#/route">{t('plan.routeFile')}</a>
            <button type="button" className="btn" onClick={() => setDemo(true)}>{t('plan.seeDemo')}</button>
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
    const tech = workspace.technicians.find((x) => x.name === name)
    note.current = { techName: name, switchedOn: tech?.active !== true }
    update((w) => toggleTechnician(w, name))
  }
  const left = prepared.left
  const leftOut = left.hold + left.review + left.noPlace

  return (
    <div className="page">
      <header className="top">
        <div>
          <h1 tabIndex={-1}>{t('plan.title')}</h1>
          {summary !== null ? (
            <p className="lede">
              {t('plan.lede', {
                cases: tn('plan.cases', summary.scheduled),
                days: tn('plan.workingDays', summary.days),
                left: summary.unscheduled > 0 ? t('plan.left', { count: formatNumber(summary.unscheduled) }) : '',
                used: formatNumber(summary.techniciansUsed),
                total: formatNumber(summary.techniciansTotal),
                drive: hours(summary.travelHours),
                onsite: hours(summary.onSiteHours),
                start: prepared.planStart,
              })}
            </p>
          ) : (
            <p className="lede">{error === null ? t('plan.planning') : ''}</p>
          )}
        </div>
      </header>

      {error !== null && <p className="error" role="alert">{t('plan.error', { error })}</p>}

      {large !== null && (
        <p className="alert alert-note" role="status">
          {t('plan.large', {
            cases: formatNumber(large.cases), technicians: formatNumber(large.technicians), days: formatNumber(large.days),
            testedCases: formatNumber(TESTED_SIZE.cases), testedTechnicians: formatNumber(TESTED_SIZE.technicians), testedDays: formatNumber(TESTED_SIZE.days),
          })}
        </p>
      )}

      {advice !== null && (
        <div className="alert alert-note" role="status">
          <p>{t('plan.baseFar', { km: formatNumber(advice.nearestKm) })}</p>
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-primary" onClick={putBaseInMiddle}>{t('plan.baseMiddle')}</button>
            <a className="btn" href="#/setup">{t('plan.openSetup')}</a>
          </div>
        </div>
      )}

      {advice === null && summary !== null && summary.scheduled === 0 && (
        <p className="alert alert-note" role="status">{nothingPlannedHint(prepared.input)} <a href="#/setup">{t('plan.openSetup')}</a></p>
      )}

      {input !== null && result !== null && day !== undefined && (
        <>
          <div className="days" role="group" aria-label={t('plan.chooseDay')}>
            {days.map((d) => (
              <button key={d.day} type="button" className="day" aria-pressed={d.day === day} onClick={() => setPicked(d.day)}>
                <span className="day-name">{d.weekday}</span>
                <span className="day-date">{d.date}</span>
                <span className="day-count">{tn('plan.visits', d.visits)}</span>
              </button>
            ))}
          </div>

          <ul className="legend" aria-label={t('plan.colours')}>
            {input.workTypes.map((w, i) => (
              <li key={w.name}><span className={`swatch w${i % 6}`} aria-hidden="true" />{w.name}</li>
            ))}
            <li><span className="swatch travel" aria-hidden="true" />{t('plan.driving')}</li>
            <li><span className="swatch break" aria-hidden="true" />{t('plan.break')}</li>
          </ul>

          <p className="change" role="status" aria-live="polite">
            {change !== null ? changeText(change) : t('plan.switchHint')}
          </p>

          <Board input={input} result={result} day={day} change={change} busy={busy} onToggle={onToggle} />

          <DayMap input={input} result={result} day={day} />

          <ShareBar workspace={workspace} input={input} caseIds={prepared.caseIds} planStart={prepared.planStart} result={result} day={day} busy={busy} />

          <ReportsPanel workspace={workspace} update={update} input={input} result={result} day={day} />
        </>
      )}

      {result !== null && result.unscheduled.length > 0 && (
        <section className="stack-tight" aria-label={t('plan.notPlanned.aria')} style={{ marginTop: 24 }}>
          <h2 className="step-heading">{t('plan.notPlanned.title', { count: formatNumber(result.unscheduled.length) })}</h2>
          <ul className="issues">
            {result.unscheduled.slice(0, 20).map((u) => <li key={u.id}><b>{u.id}</b>: {u.reason}</li>)}
          </ul>
          {result.unscheduled.length > 20 && <p className="muted small">{t('plan.more', { count: formatNumber(result.unscheduled.length - 20) })}</p>}
        </section>
      )}

      {leftOut > 0 && (
        <p className="muted" style={{ marginTop: 24 }}>
          {t('plan.leftOut', { hold: formatNumber(left.hold), review: formatNumber(left.review), noPlace: formatNumber(left.noPlace) })} <a href="#/data">{t('plan.seeData')}</a>
        </p>
      )}
    </div>
  )
}
