import { lazy, Suspense, useMemo } from 'react'
import type { PlanInput, PlanResult } from '../../engine'
import { dayLabel } from '../../demo/viewModel'
import { dayLayers } from '../../map/layers'

const MapCanvas = lazy(() => import('../../map/MapCanvas'))

/** The routes of the chosen day on a map. The map code loads when this is first shown. */
export function DayMap({ input, result, day }: { input: PlanInput; result: PlanResult; day: number }) {
  const data = useMemo(() => dayLayers(input, result, day), [input, result, day])
  const label = dayLabel(day)
  return (
    <section className="stack-tight" aria-label="Map of the day" style={{ marginTop: 24 }}>
      <h2 className="step-heading">Map of {label.weekday} {label.date}</h2>
      <Suspense fallback={<p className="muted">Loading the map…</p>}>
        <MapCanvas key={day} data={data} title={`${label.weekday} ${label.date}`} />
      </Suspense>
    </section>
  )
}
