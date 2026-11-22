import { t } from '../../i18n'
import { REASONS, STATUSES, MAX_REMARKS, type Reason, type Status, type Visit } from '../../share/report'

/** The time of day on this phone, `HH:MM`. */
function clockNow(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface Props {
  /** The stop's number, for the names of the controls. */
  n: string
  caseId: string
  /** What has been entered for this visit, if anything. */
  visit: Visit | undefined
  onChange: (visit: Visit) => void
  onForget: () => void
}

/**
 * The technician's report of one visit: how it went (Done, Partly done, Not done), and for the last two why; when it
 * was finished; remarks. Pressing the status that is chosen takes the report of the visit back. Everything is saved as it is
 * entered, on the phone, so it works with no connection.
 */
export function StopReport({ n, caseId, visit, onChange, onForget }: Props) {
  const choose = (status: Status): void => {
    if (visit?.status === status) {
      onForget()
      return
    }
    onChange({ caseId, status, finishedAt: visit?.finishedAt ?? clockNow(), ...(status === 'done' || visit?.reason === undefined ? {} : { reason: visit.reason }), ...(visit?.remarks === undefined ? {} : { remarks: visit.remarks }) })
  }

  return (
    <div className="stop-report no-print" role="group" aria-label={t('report.visit.aria', { n })}>
      <div className="row">
        {STATUSES.map((status) => (
          <button key={status} type="button" className="btn status-btn" data-status={status} aria-pressed={visit?.status === status} onClick={() => choose(status)}>
            {t(`report.status.${status}`)}
          </button>
        ))}
      </div>

      {visit !== undefined && (
        <div className="stack-tight">
          {visit.status !== 'done' && (
            <label className="field">
              <span className="label">{t('report.reason.label')}</span>
              <select value={visit.reason ?? ''} onChange={(e) => { const { reason: _gone, ...rest } = visit; onChange(e.target.value === '' ? rest : { ...rest, reason: e.target.value as Reason }) }}>
                <option value="">{t('report.reason.choose')}</option>
                {REASONS.map((r) => <option key={r} value={r}>{t(`report.reason.${r}`)}</option>)}
              </select>
            </label>
          )}
          <label className="field">
            <span className="label">{t('report.time.label')}</span>
            <input type="time" value={visit.finishedAt ?? ''} onChange={(e) => onChange({ ...visit, finishedAt: e.target.value })} />
          </label>
          <label className="field">
            <span className="label">{t('report.remarks.label')}</span>
            <textarea rows={3} maxLength={MAX_REMARKS} value={visit.remarks ?? ''} onChange={(e) => onChange({ ...visit, remarks: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  )
}
