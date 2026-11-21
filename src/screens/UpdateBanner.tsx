import { applyUpdate } from '../pwa/register'
import { usePwa } from '../pwa/usePwa'

/** Shown when a newer version of the app has been downloaded. The page never reloads by itself. */
export function UpdateBanner() {
  const { updateReady } = usePwa()
  if (!updateReady) return null
  return (
    <p className="banner row" role="status">
      <span>A new version of the app is ready.</span>
      <button type="button" className="btn" onClick={applyUpdate}>Reload</button>
    </p>
  )
}
