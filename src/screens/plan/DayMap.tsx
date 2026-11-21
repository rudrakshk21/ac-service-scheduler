import { lazy, Suspense, useMemo } from 'react'
import type { PlanInput, PlanResult } from '../../engine'
import { dayLabel } from '../../demo/viewModel'
import { t } from '../../i18n'
import { dayLayers } from '../../map/layers'

const MapCanvas = lazy(() => import('../../map/MapCanvas'))

/** The routes of the chosen day on a map. The map code loads when this is first shown. */
export function DayMap({ input, result, day }: { input: PlanInput; result: PlanResult; day: number }) {
  const data = useMemo(() => dayLayers(input, result, day), [input, result, day])
  const label = dayLabel(day)
  const name = `${label.weekday} ${label.date}`
  return (
    <section className="stack-tight" aria-label={t('map.day.aria')} style={{ marginTop: 24 }}>
      <h2 className="step-heading">{t('map.day.heading', { day: name })}</h2>
      <Suspense fallback={<p className="muted">{t('map.loading')}</p>}>
        <MapCanvas key={day} data={data} title={name} />
      </Suspense>
    </section>
  )
}
