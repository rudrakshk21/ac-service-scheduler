import { useState } from 'react'
import { formatNumber, t, tn } from '../../i18n'
import { buildReport, reportFileName, serialiseReport, type Visit } from '../../share/report'
import type { RoutePack } from '../../share/routePack'
import { shareOrDownload } from '../../share/shareFile'
import { madeText } from './format'

interface Props {
  pack: RoutePack
  /** What has been entered for this route. */
  visits: Visit[]
  /** When the report was last made into a file, an ISO time, or undefined. */
  sentAt: string | undefined
  onSent: (at: string) => void
}

/** How many visits are reported, a warning about the remarks, and the button that makes the report into a file to send. */
export function SendReport({ pack, visits, sentAt, onSent }: Props) {
  const [status, setStatus] = useState('')
  const entered = pack.stops.filter((s) => visits.some((v) => v.caseId === s.caseId)).length

  const send = async (): Promise<void> => {
    const now = new Date().toISOString()
    const file = buildReport(pack, visits, now)
    const name = reportFileName(file)
    // Chrome on Android refuses .json in the share sheet but takes plain text; the planner opens either.
    const outcome = await shareOrDownload(name, serialiseReport(file), 'application/json', { fileName: name.replace(/\.json$/i, '.txt'), type: 'text/plain' })
    if (outcome === 'cancelled') return
    onSent(now)
    const what = t('report.what', { name: pack.technician })
    setStatus(outcome === 'shared' ? t('share.shared', { what }) : t('share.saved', { what }))
  }

  return (
    <section className="stack-tight send-report no-print" aria-label={t('report.title')}>
      <h2 className="step-heading">{t('report.title')}</h2>
      <p className="muted">{t('report.lede')}</p>
      <p className="alert alert-note">{t('report.warning')}</p>
      <p>{t('report.summary', { entered: formatNumber(entered), visits: tn('plan.visits', pack.stops.length) })}</p>
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={entered === 0} onClick={() => void send()}>{t('report.send')}</button>
      </div>
      {entered === 0 && <p className="muted small">{t('report.none')}</p>}
      {sentAt !== undefined && <p className="muted small">{t('report.sentAt', { when: madeText(sentAt) })}</p>}
      <p className="muted" role="status" aria-live="polite">{status}</p>
    </section>
  )
}
