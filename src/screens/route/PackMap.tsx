import { lazy, Suspense, useMemo } from 'react'
import { t } from '../../i18n'
import { packLayers } from '../../map/layers'
import type { RoutePack } from '../../share/routePack'

const MapCanvas = lazy(() => import('../../map/MapCanvas'))

/** The stops of a route pack on a map, in order. Drawn from the coordinates in the file, so it works with no connection. */
export function PackMap({ pack }: { pack: RoutePack }) {
  const data = useMemo(() => packLayers(pack), [pack])
  return (
    <Suspense fallback={<p className="muted">{t('map.loading')}</p>}>
      <MapCanvas key={`${pack.technician}|${pack.date}`} data={data} title={`${pack.technician}, ${pack.date}`} />
    </Suspense>
  )
}
