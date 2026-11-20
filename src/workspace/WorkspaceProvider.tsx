import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { memoryStore, openIndexedStore, type KeyValueStore } from './db'
import { WorkspaceContext, type StorageStatus } from './useWorkspace'
import { emptyWorkspace, loadWorkspace, saveWorkspace, WorkspaceError, type Workspace } from './workspace'

const NOT_KEPT = 'Your data cannot be kept in this browser (a private window, or storage is blocked). It will be lost when you close this page.'

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace>(() => emptyWorkspace())
  const [status, setStatus] = useState<StorageStatus>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const store = useRef<KeyValueStore | null>(null)
  const latest = useRef<Workspace>(workspace)
  const asked = useRef(false)

  useEffect(() => {
    let live = true
    void (async () => {
      let loaded: Workspace | null = null
      let next: StorageStatus = 'ready'
      let note: string | null = null
      try {
        store.current = await openIndexedStore()
        loaded = await loadWorkspace(store.current)
      } catch (e) {
        // Data that is damaged or from a newer version is never overwritten: work in memory instead.
        store.current = memoryStore()
        next = 'memory'
        note = e instanceof WorkspaceError ? `${e.message} Changes made now will not be saved.` : NOT_KEPT
      }
      if (!live) return
      latest.current = loaded ?? emptyWorkspace()
      setWorkspace(latest.current)
      setMessage(note)
      setStatus(next)
    })()
    return () => {
      live = false
    }
  }, [])

  const update = useCallback((change: (w: Workspace) => Workspace) => {
    const next = change(latest.current)
    latest.current = next
    setWorkspace(next)
    const s = store.current
    if (s === null) return
    saveWorkspace(s, next).then(
      () => {
        if (!asked.current) {
          asked.current = true
          void navigator.storage?.persist?.()
        }
      },
      () => {
        setStatus('memory')
        setMessage(NOT_KEPT)
      },
    )
  }, [])

  const value = useMemo(() => ({ workspace, status, message, update }), [workspace, status, message, update])
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
