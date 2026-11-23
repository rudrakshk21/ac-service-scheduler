import { formatNumber, t } from '../../i18n'
import { mapsKind, mapsLink } from '../../share/mapsLink'
import type { Visit } from '../../share/report'
import type { RoutePack } from '../../share/routePack'
import { StopReport } from './StopReport'
import './route.css'

/** What the Route tab adds to each stop so that the technician can report it. The printed sheet has none. */
export interface StopReports {
  visits: Visit[]
  onChange: (visit: Visit) => void
  onForget: (caseId: string) => void
}

/** The ordered stops of one route. Read-only on the printed sheet; on the Route tab each stop can also be reported. */
export function RouteList({ pack, reports }: { pack: RoutePack; reports?: StopReports }) {
  const kind = mapsKind(navigator.userAgent)
  return (
    <ol className="route-list" aria-label={t('route.list.aria', { name: pack.technician })}>
      {pack.stops.map((s) => (
        <li key={s.visit} className="route-stop">
          <span className="route-no">
            {/* A label on a plain span is not read by many screen readers, so the full words are text that only they see. */}
            <span aria-hidden="true">{formatNumber(s.visit)}</span>
            <span className="visually-hidden">{t('route.stop.aria', { n: formatNumber(s.visit) })}</span>
          </span>
          <div className="route-body">
            <div className="route-head">
              <b className="route-time">{s.arrival}</b>
              <span>{s.caseId}</span>
              <span className="muted">{s.workType}</span>
            </div>
            <div>{s.place}</div>
            <div className="muted small">{t('route.stop.drive', { km: formatNumber(s.kilometres), min: formatNumber(s.drivingMinutes) })}</div>
            {/* A computer or an iPhone cannot open a geo: link, so there it is a web link, in a new tab so the route stays open. */}
            <a
              className="route-maplink no-print"
              href={mapsLink(s.lat, s.lon, t('route.stop.pin', { n: formatNumber(s.visit), case: s.caseId }), kind)}
              {...(kind === 'web' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {t('route.stop.maps')}
            </a>
            {reports !== undefined && (
              <StopReport
                n={formatNumber(s.visit)}
                caseId={s.caseId}
                visit={reports.visits.find((v) => v.caseId === s.caseId)}
                onChange={reports.onChange}
                onForget={() => reports.onForget(s.caseId)}
              />
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
