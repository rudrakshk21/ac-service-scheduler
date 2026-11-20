import { useRef, useState, type DragEvent } from 'react'
import { suggestProfile } from '../../intake/map/suggest'
import type { Kind } from '../../intake/map/model'
import { readSource } from '../../intake/read'
import type { ReadOptions } from '../../intake/read/table'
import { profileFor } from '../../workspace/actions'
import { useWorkspace } from '../../workspace/useWorkspace'
import { describeTable, guessKind, KIND_LABELS } from './importFlow'
import type { StepProps } from './StepProps'

const ENCODINGS: [string, string][] = [
  ['utf-8', 'UTF-8'], ['windows-1252', 'Windows-1252 (Western European)'], ['windows-1251', 'Windows-1251 (Cyrillic)'],
  ['windows-1256', 'Windows-1256 (Arabic)'], ['utf-16le', 'UTF-16'], ['shift_jis', 'Shift JIS (Japanese)'], ['gbk', 'GBK (Chinese)'],
]
const DELIMITERS: [string, string][] = [[',', 'Comma'], [';', 'Semicolon'], ['\t', 'Tab'], ['|', 'Bar']]
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
      const t = await readSource(s.data, s.name, options.current)
      const k = kind ?? guessKind(t, workspace.site)
      const result = suggestProfile(t, k, workspace.site, s.name)
      dispatch({ type: 'file', table: t, fileName: s.name, kind: k, result, known: profileFor(workspace, k, result.profile.fingerprint) ?? null })
    } catch (e) {
      dispatch({ type: 'error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  async function choose(file: File | undefined) {
    if (file === undefined) return
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
      <h2 className="step-heading" tabIndex={-1} data-step-heading>Choose a file</h2>
      <p className="muted">A CSV, Excel (.xlsx) or JSON export from your system. The file stays in this browser.</p>
      <label
        className={over ? 'drop over' : 'drop'}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <strong>{table === null ? 'Choose a file or drop it here' : 'Choose a different file'}</strong>
        <span className="muted small">{busy ? 'Reading…' : table === null ? '.csv, .txt, .xlsx or .json' : flow.fileName}</span>
        <input type="file" accept=".csv,.tsv,.txt,.xlsx,.json" onChange={(e) => void choose(e.target.files?.[0])} />
      </label>

      {table !== null && (
        <>
          <div className="card stack-tight" aria-live="polite">
            <b>{flow.fileName}</b>
            <span>{describeTable(table)}</span>
            {flow.knownProfile && (
              <span className="badge badge-ok">You have imported a file with these columns before. The saved matching will be used.</span>
            )}
            {!table.detected.encodingConfident && (
              <span className="muted small">The text encoding was guessed. If letters look wrong below, choose another one under "Not reading right?".</span>
            )}
          </div>

          <fieldset className="kinds">
            <legend>What is in this file?</legend>
            {KINDS.map((k) => (
              <label key={k}>
                <input type="radio" name="kind" checked={flow.kind === k} onChange={() => setKind(k)} />
                <span>{KIND_LABELS[k]}</span>
              </label>
            ))}
          </fieldset>

          <div className="scroll-x" role="region" aria-label="First rows of the file" tabIndex={0}>
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
            <summary>Not reading right?</summary>
            <div className="grid">
              {table.format === 'csv' && (
                <>
                  <label className="field">
                    <span className="label">Text encoding</span>
                    <select value={table.detected.encoding} onChange={(e) => setOption({ encoding: e.target.value })}>
                      {ENCODINGS.some(([v]) => v === table.detected.encoding) ? null : <option value={table.detected.encoding}>{table.detected.encoding}</option>}
                      {ENCODINGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">Columns are separated by</span>
                    <select value={table.detected.delimiter ?? ','} onChange={(e) => setOption({ delimiter: e.target.value })}>
                      {DELIMITERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                </>
              )}
              {table.sheets.length > 1 && (
                <label className="field">
                  <span className="label">Sheet</span>
                  <select value={table.sheet} onChange={(e) => setOption({ sheet: e.target.value })}>
                    {table.sheets.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              )}
              <label className="field">
                <span className="label">The column names are on row</span>
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
