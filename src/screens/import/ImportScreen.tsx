import { useEffect, useReducer, useRef, useState } from 'react'
import { useWorkspace } from '../../workspace/useWorkspace'
import { CheckStep } from './CheckStep'
import { ColumnsStep } from './ColumnsStep'
import { FileStep } from './FileStep'
import { canContinue, flowReducer, initialFlow, type Step } from './importFlow'
import { ValuesStep } from './ValuesStep'
import './import.css'

const STEPS: { id: Exclude<Step, 'done'>; label: string }[] = [
  { id: 'file', label: 'File' },
  { id: 'columns', label: 'Columns' },
  { id: 'values', label: 'Words' },
  { id: 'check', label: 'Check' },
]

export default function ImportScreen() {
  const { workspace } = useWorkspace()
  const [flow, dispatch] = useReducer(flowReducer, initialFlow)
  const [doneLines, setDoneLines] = useState<string[]>([])
  const first = useRef(true)

  // After a step change, move focus to the new step's heading.
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    document.querySelector<HTMLElement>('[data-step-heading]')?.focus()
  }, [flow.step])

  const here = flow.step === 'done' ? STEPS.length : STEPS.findIndex((s) => s.id === flow.step)
  const verdict =
    flow.profile === null
      ? { ok: false, reason: 'Choose a file first.' }
      : canContinue(flow.step === 'done' ? 'check' : flow.step, { kind: flow.kind, profile: flow.profile, table: flow.table, site: workspace.site, leaveInReview: flow.leaveInReview })

  return (
    <section className="screen">
      <h1 className="screen-title" tabIndex={-1}>Import</h1>
      <p className="screen-lede">Bring in service cases, technicians or places from a file. You match its columns once and the app remembers.</p>

      <ol className="steps" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s.id} aria-current={i === here ? 'step' : undefined} className={i < here ? 'done' : undefined}>
            <span className="n" aria-hidden="true">{i < here ? '✓' : i + 1}</span>
            <span className="lbl" aria-hidden="true">{s.label}</span>
            <span className="visually-hidden">{`${s.label}${i < here ? ' (done)' : i === here ? ' (current step)' : ''}`}</span>
          </li>
        ))}
      </ol>

      <div className="stack" style={{ marginTop: 16 }}>
        {flow.error !== null && <p className="alert" role="alert">{flow.error}</p>}

        {flow.step === 'file' && <FileStep flow={flow} dispatch={dispatch} />}
        {flow.step === 'columns' && <ColumnsStep flow={flow} dispatch={dispatch} />}
        {flow.step === 'values' && <ValuesStep flow={flow} dispatch={dispatch} />}
        {flow.step === 'check' && <CheckStep flow={flow} dispatch={dispatch} onDone={setDoneLines} />}
        {flow.step === 'done' && (
          <div className="done-box" role="status">
            <h2 className="step-heading" tabIndex={-1} data-step-heading>Imported</h2>
            {doneLines.map((l) => <p key={l}>{l}</p>)}
            <div className="row">
              <a className="btn btn-primary" href="#/data">See the data</a>
              <button type="button" className="btn" onClick={() => dispatch({ type: 'reset' })}>Import another file</button>
            </div>
          </div>
        )}

        {flow.step !== 'done' && (
          <div className="step-nav">
            {flow.step !== 'check' && !verdict.ok && <p className="why" role="status">{verdict.reason}</p>}
            {flow.step !== 'file' && <button type="button" className="btn" onClick={() => dispatch({ type: 'back' })}>Back</button>}
            {flow.step !== 'check' && (
              <button type="button" className="btn btn-primary" disabled={!verdict.ok} onClick={() => dispatch({ type: 'next' })}>Continue</button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
