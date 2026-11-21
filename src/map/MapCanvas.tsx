import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { MapData, MapLayer, MapStop } from './layers'
import { fitProjection, fullView, MAX_ZOOM, panView, scaleBar, zoomOf, zoomView, type View } from './project'
import './map.css'

const W = 720
const H = 480
const PAD = 44
const CANVAS = { w: W, h: H }

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/**
 * The width in pixels an element is drawn at, and the callback ref to put on it. It is measured as soon as the element
 * appears (which does not wait for the page to paint) and then kept up to date when the element changes size.
 */
function useWidth(): [number, (el: Element | null) => (() => void) | undefined] {
  const [width, setWidth] = useState(0)
  const attach = useCallback((el: Element | null) => {
    if (el === null) return undefined
    setWidth(el.clientWidth)
    const watch = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  return [width, attach]
}

/**
 * A map drawn from the coordinates alone (FR-18.3): the base, the stops of each technician numbered in order with a
 * label that tells the technicians apart, a line for each route, a scale bar, zoom and pan. It needs no network.
 * Sizes are in screen pixels, so a marker is as easy to tap on a phone as on a large screen.
 */
export default function MapCanvas({ data, title }: { data: MapData; title: string }) {
  const points = useMemo(() => [...(data.base === null ? [] : [data.base]), ...data.layers.flatMap((l) => l.path)], [data])
  const projection = useMemo(() => fitProjection(points, W, H, PAD), [points])
  const [view, setView] = useState<View>(() => fullView(W, H))
  const [picked, setPicked] = useState<{ key: string; visit: number } | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [width, measure] = useWidth()

  const zoom = zoomOf(view, CANVAS)
  /** Frame units for a length in screen pixels. */
  const px = (n: number): number => n / ((width > 0 ? width : W) / view.w)
  const at = (p: { lat: number; lon: number }) => projection.project(p)
  const line = (ps: { lat: number; lon: number }[]): string => ps.map((p) => `${at(p).x.toFixed(1)},${at(p).y.toFixed(1)}`).join(' ')

  const zoomBy = (factor: number): void => setView((v) => zoomView(v, CANVAS, factor))
  const onPointerDown = (e: PointerEvent<SVGSVGElement>): void => {
    if (zoom <= 1) return
    drag.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<SVGSVGElement>): void => {
    const from = drag.current
    if (from === null) return
    const k = view.w / e.currentTarget.getBoundingClientRect().width
    const dx = -(e.clientX - from.x) * k
    const dy = -(e.clientY - from.y) * k
    drag.current = { x: e.clientX, y: e.clientY }
    setView((v) => panView(v, CANVAS, dx, dy))
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    const step = view.w / 10
    if (e.target !== e.currentTarget) return
    if (e.key === '+' || e.key === '=') zoomBy(1.5)
    else if (e.key === '-') zoomBy(1 / 1.5)
    else if (e.key === '0') setView(fullView(W, H))
    else if (e.key === 'ArrowLeft') setView((v) => panView(v, CANVAS, -step, 0))
    else if (e.key === 'ArrowRight') setView((v) => panView(v, CANVAS, step, 0))
    else if (e.key === 'ArrowUp') setView((v) => panView(v, CANVAS, 0, -step))
    else if (e.key === 'ArrowDown') setView((v) => panView(v, CANVAS, 0, step))
    else return
    e.preventDefault()
  }

  if (data.layers.length === 0) return <p className="muted">There are no routes to show on a map.</p>

  const bar = scaleBar(projection.kmPerPx, view.w / 5)
  const pickedLayer = picked === null ? undefined : data.layers.find((l) => l.key === picked.key)
  const pickedStop = pickedLayer?.stops.find((s) => s.visit === picked?.visit)

  const stopMarker = (layer: MapLayer, s: MapStop) => {
    const { x, y } = at(s)
    const on = picked?.key === layer.key && picked.visit === s.visit
    const choose = (): void => setPicked(on ? null : { key: layer.key, visit: s.visit })
    return (
      <g
        key={`${layer.key}-${s.visit}`}
        className={`map-stop map-c${layer.colour}`}
        transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
        role="button"
        tabIndex={0}
        aria-pressed={on}
        aria-label={`${layer.name}, stop ${s.visit}: case ${s.caseId} at ${s.arrival}, ${s.place}`}
        onClick={choose}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose() } }}
      >
        <circle className="hit" r={px(24)} />
        <circle className="ring" r={px(19)} strokeWidth={px(3)} />
        <circle className="dot" r={px(15)} strokeWidth={px(2)} />
        <text fontSize={px(12)}>{layer.label}{s.visit}</text>
      </g>
    )
  }

  return (
    <div className="map-wrap" onKeyDown={onKey}>
      <svg
        ref={measure}
        className={zoom > 1 ? 'map-svg zoomed' : 'map-svg'}
        viewBox={`${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`}
        role="group"
        aria-label={`Map of ${title}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null }}
      >
        {data.layers.map((layer) => {
          const mid = layer.stops.map((s) => ({ lat: s.lat, lon: s.lon }))
          const hasLegs = layer.path.length === layer.stops.length + 2
          const dash = `${px(8)} ${px(7)}`
          return (
            <g key={layer.key} className={`map-c${layer.colour}`}>
              <polyline className="map-line" points={line(mid)} strokeWidth={px(3.5)} />
              {hasLegs && (
                <>
                  <polyline className="map-leg" points={line([layer.path[0], ...mid.slice(0, 1)])} strokeWidth={px(3)} strokeDasharray={dash} />
                  <polyline className="map-leg" points={line([...mid.slice(-1), layer.path[layer.path.length - 1]])} strokeWidth={px(3)} strokeDasharray={dash} />
                </>
              )}
            </g>
          )
        })}

        {data.base !== null && (
          <g className="map-base" transform={`translate(${at(data.base).x.toFixed(1)} ${at(data.base).y.toFixed(1)})`} role="img" aria-label="The base of the centre">
            <rect className="shape" x={-px(9)} y={-px(9)} width={px(18)} height={px(18)} transform="rotate(45)" />
            <text y={px(28)} fontSize={px(12)}>Base</text>
          </g>
        )}

        {data.layers.map((layer) => layer.stops.map((s) => stopMarker(layer, s)))}

        <g className="map-scale" aria-hidden="true">
          <line x1={view.x + view.w * 0.04} x2={view.x + view.w * 0.04 + bar.px} y1={view.y + view.h * 0.95} y2={view.y + view.h * 0.95} strokeWidth={px(2.5)} />
          <text x={view.x + view.w * 0.04 + bar.px / 2} y={view.y + view.h * 0.95 - px(6)} fontSize={px(12)}>{bar.label}</text>
        </g>
      </svg>

      <div className="map-tools no-print" role="group" aria-label="Zoom the map">
        <button type="button" className="btn" aria-label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => zoomBy(1.5)}>+</button>
        <button type="button" className="btn" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => zoomBy(1 / 1.5)}>−</button>
        <button type="button" className="btn" disabled={zoom <= 1} onClick={() => setView(fullView(W, H))}>Whole map</button>
      </div>

      <ul className="map-legend" aria-label="Who is who on the map">
        {data.layers.map((l) => (
          <li key={l.key} className={`map-c${l.colour}`}>
            <span className="map-swatch" aria-hidden="true">{l.label}</span>
            <span>{l.name}, {plural(l.stops.length, 'stop', 'stops')}</span>
          </li>
        ))}
      </ul>

      <p className="muted small" role="status" aria-live="polite">
        {pickedLayer !== undefined && pickedStop !== undefined
          ? `${pickedLayer.name}, stop ${pickedStop.visit}: case ${pickedStop.caseId}, arrival ${pickedStop.arrival}, ${pickedStop.place}.`
          : 'Tap a stop to see its details. Distances are drawn true to scale; there is no street map.'}
      </p>
    </div>
  )
}
