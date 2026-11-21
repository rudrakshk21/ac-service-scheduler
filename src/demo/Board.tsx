import { useMemo, useState } from 'react'
import type { PlanInput, PlanResult } from '../engine'
import { formatNumber, t, tn } from '../i18n'
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

const hoursText = (minutes: number): string => formatNumber(minutes / 60, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** The dispatch board: one lane per technician across the working day, built from blocks sized by real minutes. */
export function Board({ input, result, day, change, busy, onToggle }: BoardProps) {
  const lanes = useMemo(() => lanesForDay(input, result, day), [input, result, day])
  const axis = useMemo(() => dayAxis(input, lanes), [input, lanes])
  const [open, setOpen] = useState<number | null>(null)
  const span = axis.endMin - axis.startMin
  const pct = (minute: number): number => ((minute - axis.startMin) / span) * 100

  return (
    <section className="board" aria-label={t('board.aria')}>
      <div className="axis" aria-hidden="true">
        {axis.ticks.slice(0, -1).map((tick) => (
          <span key={tick} className="tick" style={{ insetInlineStart: `${pct(tick)}%` }}>
            {String(Math.floor(tick / 60)).padStart(2, '0')}
          </span>
        ))}
      </div>
      <ul className="lanes">
        {lanes.map((lane) => {
          const changed = change !== null && change.techs.has(lane.tech)
          const pulse = changed ? (change.id % 2 === 0 ? 'a' : 'b') : undefined
          const expanded = open === lane.tech && lane.stops.length > 0
          return (
            <li key={lane.tech} className="lane" data-off={!lane.active} data-open={expanded} data-pulse={pulse}>
              <div className="lane-head">
                <div className="lane-title">
                  <span className="lane-name">{lane.name}</span>
                  <span className="lane-meta">{laneMeta(lane)}</span>
                </div>
                <div className="lane-actions">
                  {lane.stops.length > 0 && (
                    <button
                      type="button"
                      className="btn lane-toggle"
                      aria-expanded={expanded}
                      aria-label={t('board.toggleAria', { action: expanded ? t('board.hideStops') : t('board.showStops'), name: lane.name })}
                      onClick={() => setOpen(expanded ? null : lane.tech)}
                    >
                      {expanded ? t('board.hideStops') : t('board.showStops')}
                    </button>
                  )}
                  <label className="switch">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={lane.active}
                      aria-label={t('board.switchAria', { name: lane.name })}
                      disabled={busy}
                      onChange={() => onToggle(lane.tech)}
                    />
                    <span className="track" aria-hidden="true" />
                    <span className="switch-text">{t('board.active')}</span>
                  </label>
                </div>
              </div>
              <LaneBar lane={lane} input={input} pct={pct} />
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
                      <span className="stop-leg">{t('board.legLabel', { min: formatNumber(Math.round(s.travelMin)) })}</span>
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
  if (!lane.active) return t('board.off')
  if (lane.stops.length === 0) return t('board.noVisits')
  return tn('board.meta', lane.stops.length, { onsite: hoursText(lane.serviceMin), drive: hoursText(lane.travelMin) })
}

interface LaneBarProps {
  lane: Lane
  input: PlanInput
  pct: (minute: number) => number
}

/** The day of one technician as a picture. It is not a control: the button beside the name opens the stops. */
function LaneBar({ lane, input, pct }: LaneBarProps) {
  if (lane.stops.length === 0) {
    return <div className="lane-bar lane-bar-empty">{lane.active ? t('board.noVisitsDay') : t('board.off')}</div>
  }
  // The visit number of each work block: how many work blocks come up to and including it.
  const visitAt: number[] = []
  let worked = 0
  for (const b of lane.blocks) {
    if (b.kind === 'work') worked += 1
    visitAt.push(worked)
  }
  return (
    <div className="lane-bar" role="img" aria-label={t('board.barAria', { name: lane.name, meta: laneMeta(lane) })}>
      {lane.blocks.map((b: Block, i) => {
        const style = { insetInlineStart: `${pct(b.startMin)}%`, width: `${pct(b.endMin) - pct(b.startMin)}%` }
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
    </div>
  )
}
