import { useMemo, useState } from 'react'
import type { PlanInput, PlanResult } from '../../engine'
import { dayLabel } from '../../demo/viewModel'
import { toCsv } from '../../share/csv'
import { buildPack, packFileName, routesOfDay, serialisePack, type RoutePack } from '../../share/routePack'
import { shareOrDownload, type ShareOutcome } from '../../share/shareFile'
import { buildTables } from '../../share/tables'
import type { Workspace } from '../../workspace/workspace'
import { RouteSheet } from '../route/RouteSheet'
import '../route/route.css'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
const slug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

interface Props {
  workspace: Workspace
  input: PlanInput
  caseIds: string[]
  planStart: string
  result: PlanResult
  /** The day chosen on the board, as a day number. */
  day: number
  /** A new plan is being calculated: what is shown is about to change. */
  busy: boolean
}

/** Export of the whole plan, and for the chosen day a route sheet or a route pack file per technician. */
export function ShareBar({ workspace, input, caseIds, planStart, result, day, busy }: Props) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [sheet, setSheet] = useState<RoutePack | null>(null)
  const [status, setStatus] = useState('')
  const tables = useMemo(() => buildTables(workspace, { input, caseIds, planStart }, result, today), [workspace, input, caseIds, planStart, result, today])
  const routes = useMemo(() => routesOfDay(input, result, day), [input, result, day])
  const label = dayLabel(day)

  const report = (outcome: ShareOutcome, what: string): void => {
    setStatus(outcome === 'shared' ? `Shared ${what}.` : outcome === 'downloaded' ? `Saved ${what} in your downloads.` : '')
  }
  const sendExcel = async (): Promise<void> => {
    try {
      const { toXlsx } = await import('../../share/xlsx')
      report(await shareOrDownload(`plan-${today}.xlsx`, await toXlsx(tables), XLSX_TYPE), 'the Excel file')
    } catch (e) {
      setStatus(`The Excel file could not be made. ${e instanceof Error ? e.message : ''}`.trim())
    }
  }
  const sendCsv = async (name: string): Promise<void> => {
    const table = tables.find((t) => t.name === name)
    if (table !== undefined) report(await shareOrDownload(`${slug(name)}-${today}.csv`, toCsv(table), 'text/csv'), `${name} as CSV`)
  }
  const packFor = (tech: number): RoutePack => buildPack(workspace.site.name, input, result, tech, day, new Date().toISOString())
  const sendPack = async (tech: number): Promise<void> => {
    const pack = packFor(tech)
    report(await shareOrDownload(packFileName(pack), serialisePack(pack), 'application/json'), `the route pack of ${pack.technician}`)
  }

  return (
    <section className="share-panel stack-tight" aria-label="Share and export">
      <h2 className="step-heading">Share and export</h2>

      <div className="stack-tight">
        <b>Routes of {label.weekday} {label.date}</b>
        {routes.length === 0 ? (
          <p className="muted">Nobody has a visit on this day.</p>
        ) : (
          <ul className="stack-tight" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {routes.map((r) => (
              <li key={r.tech} className="share-row">
                <span><b>{r.name}</b> <span className="muted">{plural(r.visits, 'visit', 'visits')}</span></span>
                <span className="row">
                  <button type="button" className="btn" disabled={busy} onClick={() => setSheet(packFor(r.tech))}>Route sheet</button>
                  <button type="button" className="btn" disabled={busy} onClick={() => void sendPack(r.tech)}>Share route pack</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">A route pack is a small file the technician opens in this app on their phone, with no connection. It holds case numbers, places, times and distances, no customer details.</p>
      </div>

      {sheet !== null && <RouteSheet pack={sheet} onClose={() => setSheet(null)} />}

      <div className="stack-tight no-print">
        <b>The whole plan</b>
        <div className="row">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void sendExcel()}>Excel file, all tables</button>
        </div>
        <details className="share-csv">
          <summary>CSV files, one table at a time</summary>
          <div className="row" style={{ paddingBottom: 8 }}>
            {tables.map((t) => (
              <button key={t.name} type="button" className="btn" disabled={busy} onClick={() => void sendCsv(t.name)}>{t.name}</button>
            ))}
          </div>
        </details>
      </div>

      <p className="muted" role="status" aria-live="polite">{status}</p>
    </section>
  )
}
