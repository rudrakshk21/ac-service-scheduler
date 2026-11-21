import type { RoutePack } from '../../share/routePack'
import { longDate, madeText } from './format'
import { RouteList } from './RouteList'
import './route.css'

/** A route for one technician and day, laid out to be printed (or saved as PDF from the print dialog). */
export function RouteSheet({ pack, onClose }: { pack: RoutePack; onClose: () => void }) {
  return (
    <section className="sheet print-area stack" aria-label={`Route sheet of ${pack.technician}`}>
      <header>
        <h2 className="sheet-title">{pack.technician}</h2>
        <p className="sheet-date">{longDate(pack.date)}</p>
        <p className="muted small">
          {pack.site}. Made {madeText(pack.createdAt)} for this day only. If the plan has changed since, ask for a new sheet.
        </p>
      </header>
      <RouteList pack={pack} />
      <div className="row no-print">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>Print</button>
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </div>
    </section>
  )
}
