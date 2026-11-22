import { useMemo, useState } from 'react'
import type { PlanInput, PlanResult } from '../../engine'
import { dayLabel } from '../../demo/viewModel'
import { t, tn } from '../../i18n'
import { toCsv } from '../../share/csv'
import { buildPack, packFileName, routesOfDay, serialisePack, type RoutePack } from '../../share/routePack'
import { shareOrDownload, type ShareOutcome } from '../../share/shareFile'
import { buildTables } from '../../share/tables'
import type { Workspace } from '../../workspace/workspace'
import { RouteSheet } from '../route/RouteSheet'
import '../route/route.css'

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
/** File name stems: fixed, in English letters, so a file name does not depend on the language. */
const FILE_STEM = { schedule: 'schedule', dayRoutes: 'day-routes', notPlanned: 'not-planned', summary: 'summary', changeLog: 'change-log' } as const

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
    setStatus(outcome === 'shared' ? t('share.shared', { what }) : outcome === 'downloaded' ? t('share.saved', { what }) : '')
  }
  const sendExcel = async (): Promise<void> => {
    try {
      const { toXlsx } = await import('../../share/xlsx')
      report(await shareOrDownload(`plan-${today}.xlsx`, await toXlsx(tables), XLSX_TYPE), t('share.what.excel'))
    } catch (e) {
      setStatus(t('share.excel.failed', { detail: e instanceof Error ? e.message : '' }).trim())
    }
  }
  const sendCsv = async (id: (typeof tables)[number]['id']): Promise<void> => {
    const table = tables.find((x) => x.id === id)
    if (table !== undefined) report(await shareOrDownload(`${FILE_STEM[id]}-${today}.csv`, toCsv(table), 'text/csv'), t('share.what.csv', { table: table.name }))
  }
  const packFor = (tech: number): RoutePack => buildPack(workspace.site.name, input, result, tech, day, new Date().toISOString())
  const sendPack = async (tech: number): Promise<void> => {
    const pack = packFor(tech)
    const name = packFileName(pack)
    // Chrome on Android refuses .json in the share sheet but takes plain text; the Route tab opens either.
    const asText = { fileName: name.replace(/\.json$/i, '.txt'), type: 'text/plain' }
    report(await shareOrDownload(name, serialisePack(pack), 'application/json', asText), t('share.what.pack', { name: pack.technician }))
  }

  return (
    <section className="share-panel stack-tight" aria-label={t('share.title')}>
      <h2 className="step-heading">{t('share.title')}</h2>

      <div className="stack-tight">
        <b>{t('share.routesOf', { day: `${label.weekday} ${label.date}` })}</b>
        {routes.length === 0 ? (
          <p className="muted">{t('share.nobody')}</p>
        ) : (
          <ul className="stack-tight" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {routes.map((r) => (
              <li key={r.tech} className="share-row">
                <span><b>{r.name}</b> <span className="muted">{tn('share.visits', r.visits)}</span></span>
                <span className="row">
                  <button type="button" className="btn" disabled={busy} onClick={() => setSheet(packFor(r.tech))}>{t('share.sheet')}</button>
                  <button type="button" className="btn" disabled={busy} onClick={() => void sendPack(r.tech)}>{t('share.pack')}</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">{t('share.packNote')}</p>
      </div>

      {sheet !== null && <RouteSheet pack={sheet} onClose={() => setSheet(null)} />}

      <div className="stack-tight no-print">
        <b>{t('share.whole')}</b>
        <div className="row">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void sendExcel()}>{t('share.excel')}</button>
        </div>
        <details className="share-csv">
          <summary>{t('share.csv')}</summary>
          <div className="row" style={{ paddingBottom: 8 }}>
            {tables.map((x) => (
              <button key={x.id} type="button" className="btn" disabled={busy} onClick={() => void sendCsv(x.id)}>{x.name}</button>
            ))}
          </div>
        </details>
      </div>

      <p className="muted" role="status" aria-live="polite">{status}</p>
    </section>
  )
}
