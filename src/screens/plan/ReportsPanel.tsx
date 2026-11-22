import { useMemo, useState } from 'react'
import type { PlanInput, PlanResult } from '../../engine'
import { dayLabel } from '../../demo/viewModel'
import { formatNumber, t, tn } from '../../i18n'
import { isoOf } from '../../share/dates'
import { MAX_REPORT_CHARS, parseReport, type ReportFile } from '../../share/report'
import { clearReports, daySummary, markReportedDone, mergeReports } from '../../workspace/reports'
import type { Workspace } from '../../workspace/workspace'
import { readText } from '../files'

interface Props {
  workspace: Workspace
  update: (change: (w: Workspace) => Workspace) => void
  input: PlanInput
  result: PlanResult
  /** The day chosen on the board, as a day number. */
  day: number
}

/** A file larger than this is not a report (a report is limited to `MAX_REPORT_CHARS` characters; this leaves room for UTF-8). */
const MAX_FILE_BYTES = MAX_REPORT_CHARS * 4
const SHOWN = 20

/**
 * What technicians reported. The planner opens many report files at once; the reports are read against the plan of the
 * chosen day: how many visits are reported and how they went, who has not reported, and what was not wholly done.
 */
export function ReportsPanel({ workspace, update, input, result, day }: Props) {
  const [message, setMessage] = useState('')
  const [refused, setRefused] = useState<{ name: string; message: string }[]>([])
  const [confirming, setConfirming] = useState(false)

  const date = isoOf(day)
  const label = dayLabel(day)
  const planned = useMemo(
    () => result.scheduled.filter((s) => s.day === day).map((s) => ({ caseId: s.id, technician: input.technicians[s.tech].name })),
    [result, input, day],
  )
  const summary = useMemo(() => daySummary(workspace.reports, date, planned), [workspace.reports, date, planned])
  const markable = useMemo(() => markReportedDone(workspace).marked, [workspace])

  async function open(files: FileList | null): Promise<void> {
    if (files === null || files.length === 0) return
    const good: ReportFile[] = []
    const bad: { name: string; message: string }[] = []
    await Promise.all(
      [...files].map(async (file) => {
        try {
          if (file.size > MAX_FILE_BYTES) throw new Error(t('report.err.tooBig'))
          good.push(parseReport(await readText(file)))
        } catch (e) {
          bad.push({ name: file.name, message: e instanceof Error ? e.message : t('route.error.read') })
        }
      }),
    )
    setRefused(bad.sort((a, b) => a.name.localeCompare(b.name)))
    if (good.length === 0) {
      setMessage('')
      return
    }
    // The files are merged in the order of their times, so the result does not depend on the order they were read in.
    good.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    const merged = mergeReports(workspace, good)
    update(() => merged.workspace)
    setMessage(t('reports.read', { files: tn('reports.files', good.length), added: formatNumber(merged.counts.added), updated: formatNumber(merged.counts.updated), unchanged: formatNumber(merged.counts.unchanged), older: formatNumber(merged.counts.older) }))
  }

  const markDone = (): void => {
    const done = markReportedDone(workspace)
    update(() => done.workspace)
    setMessage(t('reports.marked', { count: formatNumber(done.marked) }))
  }

  return (
    <section className="share-panel stack-tight" aria-label={t('reports.title')}>
      <h2 className="step-heading">{t('reports.title')}</h2>
      <p className="muted small">{t('reports.help')}</p>

      <div className="row">
        <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
          {t('reports.open')}
          <input type="file" multiple accept=".json,application/json,.txt,text/plain" className="visually-hidden" onChange={(e) => { void open(e.target.files); e.target.value = '' }} />
        </label>
      </div>

      {message !== '' && <p role="status" aria-live="polite">{message}</p>}
      {refused.length > 0 && (
        <div className="alert" role="alert">
          <p>{t('reports.refused', { files: tn('reports.files', refused.length) })}</p>
          <ul className="issues">
            {refused.slice(0, 5).map((r) => <li key={r.name}>{t('reports.refusedLine', { name: r.name, message: r.message })}</li>)}
          </ul>
          {refused.length > 5 && <p className="muted small">{t('reports.refusedMore', { count: formatNumber(refused.length - 5) })}</p>}
        </div>
      )}

      {summary.reported === 0 && summary.other === 0 ? (
        <p className="muted">{t('reports.none')}</p>
      ) : (
        <div className="stack-tight">
          <p>
            {t('reports.day', {
              day: `${label.weekday} ${label.date}`, reported: formatNumber(summary.reported), planned: tn('plan.visits', summary.planned),
              done: formatNumber(summary.done), partly: formatNumber(summary.partly), notDone: formatNumber(summary.notDone),
            })}
          </p>
          {summary.other > 0 && <p className="muted small">{tn('reports.other', summary.other)}</p>}
        </div>
      )}

      {summary.problems.length > 0 && (
        <div className="stack-tight">
          <b>{t('reports.problems')}</b>
          <ul className="issues">
            {summary.problems.slice(0, SHOWN).map((p) => (
              <li key={`${p.caseId}|${p.date}`}>
                <b>{p.caseId}</b>, {p.technician}: {t(`report.status.${p.status}`)}
                {p.reason !== undefined && `, ${t(`report.reason.${p.reason}`)}`}
                {p.remarks !== undefined && `, “${p.remarks}”`}
              </li>
            ))}
          </ul>
          {summary.problems.length > SHOWN && <p className="muted small">{t('reports.problemMore', { count: formatNumber(summary.problems.length - SHOWN) })}</p>}
        </div>
      )}

      {summary.waiting.length > 0 && summary.reported > 0 && (
        <p className="muted small">
          {t('reports.waiting')} {summary.waiting.slice(0, 10).map((w) => `${w.technician} (${formatNumber(w.visits)})`).join(', ')}
          {summary.waiting.length > 10 && `, ${t('reports.waitingMore', { count: formatNumber(summary.waiting.length - 10) })}`}
        </p>
      )}

      {markable > 0 && (
        <div className="stack-tight">
          <div className="row">
            <button type="button" className="btn" onClick={markDone}>{t('reports.markDone', { count: formatNumber(markable) })}</button>
          </div>
          <p className="muted small">{t('reports.markHelp')}</p>
        </div>
      )}

      {workspace.reports.length > 0 && (
        <div className="row">
          {confirming ? (
            <>
              <button type="button" className="btn danger" onClick={() => { update(clearReports); setConfirming(false); setMessage(t('reports.removed')); setRefused([]) }}>
                {t('reports.removeYes', { reports: tn('reports.count', workspace.reports.length) })}
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>{t('reports.keep')}</button>
            </>
          ) : (
            <button type="button" className="btn danger" onClick={() => setConfirming(true)}>{t('reports.remove')}</button>
          )}
        </div>
      )}
    </section>
  )
}
