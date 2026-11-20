import { useMemo, useState } from 'react'
import type { PlanInput, PlanResult } from '../engine'
import type { ChangeNote } from './useDemoPlan'
import { dayAxis, lanesForDay, type Block, type Lane } from './viewModel'

interface BoardProps {
  input: PlanInput
  result: PlanResult
  day: number
  change: ChangeNote | null
  busy: boolean
  onToggle: (tech: number) => void
}

const hoursText = (minutes: number): string => (minutes / 60).toFixed(1)
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** The dispatch board: one lane per technician across the working day, built from blocks sized by real minutes. */
export function Board({ input, result, day, change, busy, onToggle }: BoardProps) {
  const lanes = useMemo(() => lanesForDay(input, result, day), [input, result, day])
  const axis = useMemo(() => dayAxis(input, lanes), [input, lanes])
  const [open, setOpen] = useState<number | null>(null)
  const span = axis.endMin - axis.startMin
  const pct = (minute: number): number => ((minute - axis.startMin) / span) * 100

  return (
    <section className="board" aria-label="Technicians and their day">
      <div className="axis" aria-hidden="true">
        {axis.ticks.slice(0, -1).map((t) => (
          <span key={t} className="tick" style={{ left: `${pct(t)}%` }}>
            {String(Math.floor(t / 60)).padStart(2, '0')}
          </span>
        ))}
      </div>
      <ul className="lanes">
        {lanes.map((lane) => {
          const changed = change !== null && change.techs.has(lane.tech)
          const pulse = changed ? (change.id % 2 === 0 ? 'a' : 'b') : undefined
          const expanded = open === lane.tech && lane.stops.length > 0
          return (
            <li key={lane.tech} className="lane" data-off={!lane.active} data-pulse={pulse}>
              <div className="lane-head">
                <div className="lane-title">
                  <span className="lane-name">{lane.name}</span>
                  <span className="lane-meta">{laneMeta(lane)}</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={lane.active}
                    aria-label={`${lane.name} active`}
                    disabled={busy}
                    onChange={() => onToggle(lane.tech)}
                  />
                  <span className="track" aria-hidden="true" />
                  <span className="switch-text">Active</span>
                </label>
              </div>
              <LaneBar lane={lane} input={input} pct={pct} expanded={expanded} onOpen={() => setOpen(expanded ? null : lane.tech)} />
              {expanded && (
                <ol className="stops">
                  {lane.stops.map((s) => (
                    <li key={s.id} className="stop">
                      <time className="stop-time">{s.eta}</time>
                      <div className="stop-body">
                        <p className="stop-line">
                          <strong>{s.place}</strong>
                          <span className={`chip w${s.workType % 6}`}>{s.workTypeName}</span>
                          {s.flag !== '' && <span className="flag">{s.flag}</span>}
                        </p>
                        <p className="stop-why">{s.why}</p>
                      </div>
                      <span className="stop-leg">{Math.round(s.travelMin)} min driving before this stop</span>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function laneMeta(lane: Lane): string {
  if (!lane.active) return 'Switched off'
  if (lane.stops.length === 0) return 'No visits'
  return `${plural(lane.stops.length, 'stop', 'stops')}, ${hoursText(lane.serviceMin)} h on site, ${hoursText(lane.travelMin)} h driving`
}

interface LaneBarProps {
  lane: Lane
  input: PlanInput
  pct: (minute: number) => number
  expanded: boolean
  onOpen: () => void
}

function LaneBar({ lane, input, pct, expanded, onOpen }: LaneBarProps) {
  if (lane.stops.length === 0) {
    return <div className="bar bar-empty">{lane.active ? 'No visits this day' : 'Switched off'}</div>
  }
  // The visit number of each work block: how many work blocks come up to and including it.
  const visitAt: number[] = []
  let worked = 0
  for (const b of lane.blocks) {
    if (b.kind === 'work') worked += 1
    visitAt.push(worked)
  }
  return (
    <button
      type="button"
      className="bar"
      aria-expanded={expanded}
      aria-label={`${lane.name}: ${laneMeta(lane)}. ${expanded ? 'Hide' : 'Show'} the stops.`}
      onClick={onOpen}
    >
      {lane.blocks.map((b: Block, i) => {
        const style = { left: `${pct(b.startMin)}%`, width: `${pct(b.endMin) - pct(b.startMin)}%` }
        if (b.kind === 'work') {
          const name = input.workTypes[b.workType ?? 0].name
          return (
            <span key={i} className={`block work w${(b.workType ?? 0) % 6}`} style={style} title={`${visitAt[i]}: ${name}`}>
              <b>{visitAt[i]}</b>
              <small>{name.slice(0, 2)}</small>
            </span>
          )
        }
        return <span key={i} className={`block ${b.kind}`} style={style} />
      })}
    </button>
  )
}
