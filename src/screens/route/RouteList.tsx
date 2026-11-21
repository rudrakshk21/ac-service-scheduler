import { formatNumber, t } from '../../i18n'
import type { RoutePack } from '../../share/routePack'
import './route.css'

/** The ordered stops of one route, read-only. Used by the printed sheet and by the Route tab. */
export function RouteList({ pack }: { pack: RoutePack }) {
  return (
    <ol className="route-list" aria-label={t('route.list.aria', { name: pack.technician })}>
      {pack.stops.map((s) => (
        <li key={s.visit} className="route-stop">
          <span className="route-no" aria-label={t('route.stop.aria', { n: formatNumber(s.visit) })}>{formatNumber(s.visit)}</span>
          <div className="route-body">
            <div className="route-head">
              <b className="route-time">{s.arrival}</b>
              <span>{s.caseId}</span>
              <span className="muted">{s.workType}</span>
            </div>
            <div>{s.place}</div>
            <div className="muted small">{t('route.stop.drive', { km: formatNumber(s.kilometres), min: formatNumber(s.drivingMinutes) })}</div>
            <a className="route-maplink no-print" href={`geo:${s.lat},${s.lon}`}>{t('route.stop.maps')}</a>
          </div>
        </li>
      ))}
    </ol>
  )
}
