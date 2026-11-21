import { t } from '../../i18n'
import type { RoutePack } from '../../share/routePack'
import { longDate, madeText } from './format'
import { PackMap } from './PackMap'
import { RouteList } from './RouteList'
import './route.css'

/** A route for one technician and day, laid out to be printed (or saved as PDF from the print dialog). */
export function RouteSheet({ pack, onClose }: { pack: RoutePack; onClose: () => void }) {
  return (
    <section className="sheet print-area stack" aria-label={t('sheet.aria', { name: pack.technician })}>
      <header>
        <h2 className="sheet-title">{pack.technician}</h2>
        <p className="sheet-date">{longDate(pack.date)}</p>
        <p className="muted small">{t('sheet.made', { site: pack.site, when: madeText(pack.createdAt) })}</p>
      </header>
      <PackMap pack={pack} />
      <RouteList pack={pack} />
      <div className="row no-print">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>{t('sheet.print')}</button>
        <button type="button" className="btn" onClick={onClose}>{t('sheet.close')}</button>
      </div>
    </section>
  )
}
