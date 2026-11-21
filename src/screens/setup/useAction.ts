import { useCallback, useState } from 'react'
import { useWorkspace } from '../../workspace/useWorkspace'
import type { Workspace } from '../../workspace/workspace'
import type { Outcome } from './setupActions'

/**
 * Runs an edit. When the edit is refused the workspace is left as it was and `error` holds the plain reason, to be
 * shown next to the control; a successful edit clears it.
 */
export function useAction(): { run: (edit: (w: Workspace) => Outcome) => void; error: string | null; clear: () => void } {
  const { update } = useWorkspace()
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(
    (edit: (w: Workspace) => Outcome) => {
      let message: string | null = null
      update((w) => {
        const o = edit(w)
        if (o.ok) return o.workspace
        message = o.error
        return w
      })
      setError(message)
    },
    [update],
  )
  return { run, error, clear: () => setError(null) }
}
