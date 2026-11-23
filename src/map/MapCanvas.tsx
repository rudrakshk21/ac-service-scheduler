import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { formatNumber, t, tn } from '../i18n'
import { declutter } from './declutter'
import type { MapData, MapLayer, MapStop } from './layers'
import { fitProjection, fullView, MAX_ZOOM, panView, scaleBar, zoomOf, zoomView, type View } from './project'
import './map.css'

const W = 720
const H = 480
const PAD = 44
const CANVAS = { w: W, h: H }
/** Markers nearer than this many screen pixels overlap (a marker is 38 px across with its ring). */
const MARKER_SPACING = 40
/** Half a marker in screen pixels: a moved marker is kept this far inside the frame. */
const MARKER_RADIUS = 19
/** A marker moved less than this many screen pixels is not marked as moved. */
const MOVED = 2

/** Where a stop's marker is drawn, and where the stop really is. */
interface Placed {
  x: number
  y: number
  trueX: number
  trueY: number
  moved: boolean
}

/** The length of the scale bar written in the language in use: kilometres, or metres when it is under one. */
const scaleLabel = (km: number): string => (km >= 1 ? t('unit.km', { n: formatNumber(km) }) : t('unit.m', { n: formatNumber(Math.round(km * 1000)) }))

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

  // Stops at one place (or close together) would be drawn on top of each other; their markers are moved apart in screen
  // pixels, so zooming in, which spreads the places, moves them back. The route lines still go to the true places.
  const placed = useMemo(() => {
    const scale = (width > 0 ? width : W) / view.w
    const stops = data.layers.flatMap((l) => l.stops.map((s) => ({ key: `${l.key}-${s.visit}`, s })))
    const home = stops.map(({ s }) => {
      const p = projection.project(s)
      return { x: p.x * scale, y: p.y * scale }
    })
    // A moved marker is kept a marker's radius inside the frame, and the spreading takes that into account.
    const apart = declutter(home, MARKER_SPACING, 3 * MARKER_SPACING, { x0: MARKER_RADIUS, y0: MARKER_RADIUS, x1: W * scale - MARKER_RADIUS, y1: H * scale - MARKER_RADIUS })
    const out = new Map<string, Placed>()
    stops.forEach(({ key }, i) => {
      out.set(key, { x: apart[i].x / scale, y: apart[i].y / scale, trueX: home[i].x / scale, trueY: home[i].y / scale, moved: Math.hypot(apart[i].x - home[i].x, apart[i].y - home[i].y) > MOVED })
    })
    return out
  }, [data, projection, view.w, width])
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

  if (data.layers.length === 0) return <p className="muted">{t('map.none')}</p>

  const bar = scaleBar(projection.kmPerPx, view.w / 5)
  const pickedLayer = picked === null ? undefined : data.layers.find((l) => l.key === picked.key)
  const pickedStop = pickedLayer?.stops.find((s) => s.visit === picked?.visit)

  const stopMarker = (layer: MapLayer, s: MapStop) => {
    const { x, y } = placed.get(`${layer.key}-${s.visit}`) ?? at(s)
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
        aria-label={t('map.stop.aria', { mark: `${layer.label}${s.visit}`, name: layer.name, visit: s.visit, case: s.caseId, time: s.arrival, place: s.place })}
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
        aria-label={t('map.aria', { title })}
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
          <g className="map-base" transform={`translate(${at(data.base).x.toFixed(1)} ${at(data.base).y.toFixed(1)})`} role="img" aria-label={t('map.base.aria')}>
            <rect className="shape" x={-px(9)} y={-px(9)} width={px(18)} height={px(18)} transform="rotate(45)" />
            <text y={px(28)} fontSize={px(12)}>{t('map.base')}</text>
          </g>
        )}

        {/* Where a moved marker really is: a small dot, joined to its marker by a thin line. */}
        {data.layers.map((layer) => (
          <g key={layer.key} className={`map-leader map-c${layer.colour}`} aria-hidden="true">
            {layer.stops.map((s) => {
              const p = placed.get(`${layer.key}-${s.visit}`)
              if (p === undefined || !p.moved) return null
              return (
                <g key={s.visit}>
                  <line x1={p.trueX.toFixed(1)} y1={p.trueY.toFixed(1)} x2={p.x.toFixed(1)} y2={p.y.toFixed(1)} strokeWidth={px(1.5)} />
                  <circle cx={p.trueX.toFixed(1)} cy={p.trueY.toFixed(1)} r={px(3.5)} strokeWidth={px(1)} />
                </g>
              )
            })}
          </g>
        ))}

        {data.layers.map((layer) => layer.stops.map((s) => stopMarker(layer, s)))}

        <g className="map-scale" aria-hidden="true">
          <line x1={view.x + view.w * 0.04} x2={view.x + view.w * 0.04 + bar.px} y1={view.y + view.h * 0.95} y2={view.y + view.h * 0.95} strokeWidth={px(2.5)} />
          <text x={view.x + view.w * 0.04 + bar.px / 2} y={view.y + view.h * 0.95 - px(6)} fontSize={px(12)}>{scaleLabel(bar.km)}</text>
        </g>
      </svg>

      <div className="map-tools no-print" role="group" aria-label={t('map.zoom.group')}>
        <button type="button" className="btn" aria-label={t('map.zoomIn')} disabled={zoom >= MAX_ZOOM} onClick={() => zoomBy(1.5)}>+</button>
        <button type="button" className="btn" aria-label={t('map.zoomOut')} disabled={zoom <= 1} onClick={() => zoomBy(1 / 1.5)}>−</button>
        <button type="button" className="btn" disabled={zoom <= 1} onClick={() => setView(fullView(W, H))}>{t('map.whole')}</button>
      </div>

      <ul className="map-legend" aria-label={t('map.legend.aria')}>
        {data.layers.map((l) => (
          <li key={l.key} className={`map-c${l.colour}`}>
            <span className="map-swatch" aria-hidden="true">{l.label}</span>
            <span>{tn('map.legend.item', l.stops.length, { name: l.name })}</span>
          </li>
        ))}
      </ul>

      <p className="muted small" role="status" aria-live="polite">
        {pickedLayer !== undefined && pickedStop !== undefined
          ? t('map.detail', { name: pickedLayer.name, visit: pickedStop.visit, case: pickedStop.caseId, time: pickedStop.arrival, place: pickedStop.place })
          : t('map.hint')}
      </p>
      {[...placed.values()].some((p) => p.moved) && <p className="muted small">{t('map.moved')}</p>}
    </div>
  )
}
