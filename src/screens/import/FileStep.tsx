import { useRef, useState, type DragEvent } from 'react'
import { t, type MessageKey } from '../../i18n'
import { suggestProfile } from '../../intake/map/suggest'
import type { Kind } from '../../intake/map/model'
import { fileTooLarge, MAX_FILE_BYTES, readSource } from '../../intake/read'
import type { ReadOptions } from '../../intake/read/table'
import { profileFor } from '../../workspace/actions'
import { useWorkspace } from '../../workspace/useWorkspace'
import { describeTable, guessKind, kindLabel } from './importFlow'
import type { StepProps } from './StepProps'

const ENCODINGS: [string, MessageKey][] = [
  ['utf-8', 'enc.utf8'], ['windows-1252', 'enc.windows1252'], ['windows-1251', 'enc.windows1251'],
  ['windows-1256', 'enc.windows1256'], ['utf-16le', 'enc.utf16'], ['shift_jis', 'enc.shiftJis'], ['gbk', 'enc.gbk'],
]
const DELIMITERS: [string, MessageKey][] = [[',', 'delim.comma'], [';', 'delim.semicolon'], ['\t', 'delim.tab'], ['|', 'delim.bar']]
const KINDS: Kind[] = ['cases', 'technicians', 'places']

export function FileStep({ flow, dispatch }: StepProps) {
  const { workspace } = useWorkspace()
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const source = useRef<{ data: Uint8Array; name: string } | null>(null)
  const options = useRef<ReadOptions>({})
  const table = flow.table

  async function read(kind?: Kind) {
    const s = source.current
    if (s === null) return
    setBusy(true)
    try {
      const parsed = await readSource(s.data, s.name, options.current)
      const k = kind ?? guessKind(parsed, workspace.site)
      const result = suggestProfile(parsed, k, workspace.site, s.name)
      dispatch({ type: 'file', table: parsed, fileName: s.name, kind: k, result, known: profileFor(workspace, k, result.profile.fingerprint) ?? null })
    } catch (e) {
      dispatch({ type: 'error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  async function choose(file: File | undefined) {
    if (file === undefined) return
    // Refuse a file that is too big before it is read into memory at all.
    if (file.size > MAX_FILE_BYTES) {
      dispatch({ type: 'error', message: fileTooLarge(file.name, file.size).message })
      return
    }
    source.current = { data: new Uint8Array(await file.arrayBuffer()), name: file.name }
    options.current = {}
    await read()
  }

  function setOption(patch: Partial<ReadOptions>) {
    options.current = { ...options.current, ...patch }
    void read(flow.kind)
  }

  function setKind(kind: Kind) {
    if (table === null) return
    const result = suggestProfile(table, kind, workspace.site, flow.fileName)
    dispatch({ type: 'kind', kind, result, known: profileFor(workspace, kind, result.profile.fingerprint) ?? null })
  }

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setOver(false)
    void choose(e.dataTransfer.files[0])
  }

  const unsure = table !== null && (!table.detected.encodingConfident || !table.detected.delimiterConfident)

  return (
    <div className="stack">
      <h2 className="step-heading" tabIndex={-1} data-step-heading>{t('import.file.heading')}</h2>
      <p className="muted">{t('import.file.help')}</p>
      <label
        className={over ? 'drop over' : 'drop'}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <strong>{table === null ? t('import.file.choose') : t('import.file.different')}</strong>
        <span className="muted small">{busy ? t('import.file.reading') : table === null ? t('import.file.types') : flow.fileName}</span>
        <input type="file" accept=".csv,.tsv,.txt,.xlsx,.json" onChange={(e) => void choose(e.target.files?.[0])} />
      </label>

      {table !== null && (
        <>
          <div className="card stack-tight" aria-live="polite">
            <b>{flow.fileName}</b>
            <span>{describeTable(table)}</span>
            {flow.knownProfile && (
              <span className="badge badge-ok">{t('import.file.known')}</span>
            )}
            {!table.detected.encodingConfident && (
              <span className="muted small">{t('import.file.encodingGuess')}</span>
            )}
          </div>

          <fieldset className="kinds">
            <legend>{t('import.file.what')}</legend>
            {KINDS.map((k) => (
              <label key={k}>
                <input type="radio" name="kind" checked={flow.kind === k} onChange={() => setKind(k)} />
                <span>{kindLabel(k)}</span>
              </label>
            ))}
          </fieldset>

          <div className="scroll-x" role="region" aria-label={t('import.file.firstRows')} tabIndex={0}>
            <table className="preview">
              <thead>
                <tr>{table.headers.map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {table.rows.slice(0, 3).map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j}>{c === null ? '' : c instanceof Date ? c.toISOString().slice(0, 10) : String(c)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="options" open={unsure}>
            <summary>{t('import.file.options')}</summary>
            <div className="grid">
              {table.format === 'csv' && (
                <>
                  <label className="field">
                    <span className="label">{t('import.file.encoding')}</span>
                    <select value={table.detected.encoding} onChange={(e) => setOption({ encoding: e.target.value })}>
                      {ENCODINGS.some(([v]) => v === table.detected.encoding) ? null : <option value={table.detected.encoding}>{table.detected.encoding}</option>}
                      {ENCODINGS.map(([v, key]) => <option key={v} value={v}>{t(key)}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">{t('import.file.delimiter')}</span>
                    <select value={table.detected.delimiter ?? ','} onChange={(e) => setOption({ delimiter: e.target.value })}>
                      {DELIMITERS.map(([v, key]) => <option key={v} value={v}>{t(key)}</option>)}
                    </select>
                  </label>
                </>
              )}
              {table.sheets.length > 1 && (
                <label className="field">
                  <span className="label">{t('import.file.sheet')}</span>
                  <select value={table.sheet} onChange={(e) => setOption({ sheet: e.target.value })}>
                    {table.sheets.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              )}
              <label className="field">
                <span className="label">{t('import.file.headerRow')}</span>
                <input
                  type="number" min={1} defaultValue={table.headerRow + 1} key={`${flow.fileName}-${table.headerRow}`}
                  onBlur={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n - 1 !== table.headerRow) setOption({ headerRow: n - 1 }) }}
                />
              </label>
            </div>
          </details>
        </>
      )}
    </div>
  )
}
