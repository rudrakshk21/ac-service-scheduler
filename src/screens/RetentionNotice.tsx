import { formatNumber, t, tn } from '../i18n'
import { useWorkspace } from '../workspace/useWorkspace'

/**
 * Said once, and kept until dismissed: the retention period the person chose removed something on its own, for example
 * because the app was opened a month after it was last used. (Removing through the Set-up control reports itself there.)
 */
export function RetentionNotice() {
  const { removed, dismissRemoved } = useWorkspace()
  if (removed === null) return null
  const what = [
    removed.cases > 0 ? tn('retention.cases', removed.cases) : '',
    removed.reports > 0 ? tn('reports.count', removed.reports) : '',
    removed.changes > 0 ? tn('retention.lines', removed.changes) : '',
  ].filter((x) => x !== '').join(', ')
  return (
    <p className="banner row" role="status">
      <span>{t('retention.notice', { what, days: formatNumber(removed.days) })}</span>
      <a className="btn" href="#/setup">{t('retention.openSetup')}</a>
      <button type="button" className="btn" onClick={dismissRemoved}>{t('retention.ok')}</button>
    </p>
  )
}
