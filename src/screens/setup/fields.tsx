import { useId, type ReactNode } from 'react'

interface BaseProps {
  label: string
  help?: string
  /** Visually hide the label when the layout already says what the field is (it stays for screen readers). */
  hideLabel?: boolean
}

function Frame({ label, help, hideLabel, id, children }: BaseProps & { id: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : 'label'}>{label}</label>
      {children}
      {help !== undefined && <span className="muted small">{help}</span>}
    </div>
  )
}

/** A text box that saves when the user leaves it or presses Enter, and only if the text changed. */
export function TextField({ label, help, hideLabel, value, onCommit }: BaseProps & { value: string; onCommit: (text: string) => void }) {
  const id = useId()
  const commit = (el: HTMLInputElement) => {
    if (el.value !== value) onCommit(el.value)
  }
  return (
    <Frame label={label} help={help} hideLabel={hideLabel} id={id}>
      <input
        id={id} type="text" defaultValue={value} key={value}
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(e.currentTarget) }}
      />
    </Frame>
  )
}

/** A number box that saves when the user leaves it or presses Enter. Text that is not a number is not saved. */
export function NumberField({ label, help, hideLabel, value, onCommit, step = 'any', min }: BaseProps & { value: number; onCommit: (n: number) => void; step?: string; min?: number }) {
  const id = useId()
  const commit = (el: HTMLInputElement) => {
    const n = Number(el.value)
    if (el.value.trim() !== '' && Number.isFinite(n) && n !== value) onCommit(n)
    else if (el.value.trim() === '') el.value = String(value)
  }
  return (
    <Frame label={label} help={help} hideLabel={hideLabel} id={id}>
      <input
        id={id} type="number" inputMode="decimal" step={step} min={min} defaultValue={value} key={value}
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(e.currentTarget) }}
      />
    </Frame>
  )
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** A time of day, kept in the workspace as minutes after midnight. */
export function TimeField({ label, help, hideLabel, minutes, onCommit, allowEmpty }: BaseProps & { minutes: number | undefined; onCommit: (minutes: number | undefined) => void; allowEmpty?: boolean }) {
  const id = useId()
  const text = minutes === undefined ? '' : `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
  return (
    <Frame label={label} help={help} hideLabel={hideLabel} id={id}>
      <input
        id={id} type="time" defaultValue={text} key={text}
        onBlur={(e) => {
          const v = e.currentTarget.value
          if (v === '') {
            if (allowEmpty && minutes !== undefined) onCommit(undefined)
            else e.currentTarget.value = text
            return
          }
          const [h, m] = v.split(':').map(Number)
          if (h * 60 + m !== minutes) onCommit(h * 60 + m)
        }}
      />
    </Frame>
  )
}

export function SelectField({ label, help, hideLabel, value, options, onChange, blank }: BaseProps & { value: string; options: string[]; onChange: (v: string) => void; blank?: string }) {
  const id = useId()
  return (
    <Frame label={label} help={help} hideLabel={hideLabel} id={id}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {blank !== undefined && <option value="">{blank}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </Frame>
  )
}

export function DateField({ label, help, hideLabel, value, onCommit }: BaseProps & { value: string | undefined; onCommit: (iso: string | undefined) => void }) {
  const id = useId()
  return (
    <Frame label={label} help={help} hideLabel={hideLabel} id={id}>
      <input id={id} type="date" value={value ?? ''} onChange={(e) => onCommit(e.target.value === '' ? undefined : e.target.value)} />
    </Frame>
  )
}

/** The message of a refused edit, next to what caused it. */
export function Refusal({ error }: { error: string | null }) {
  return error === null ? null : <p className="alert" role="alert">{error}</p>
}
