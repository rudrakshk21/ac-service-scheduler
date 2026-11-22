import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { t } from '../i18n'
import { memoryStore, openIndexedStore, type KeyValueStore } from './db'
import { anyRemoved, applyRetention } from './retention'
import { WorkspaceContext, type RemovedNotice, type StorageStatus } from './useWorkspace'
import { emptyWorkspace, loadWorkspace, saveWorkspace, WorkspaceError, type Workspace } from './workspace'

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace>(() => emptyWorkspace())
  const [status, setStatus] = useState<StorageStatus>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [removed, setRemoved] = useState<RemovedNotice | null>(null)
  const store = useRef<KeyValueStore | null>(null)
  const latest = useRef<Workspace>(workspace)
  const asked = useRef(false)

  /** Keeps to the retention period the person chose (nothing happens when none is chosen) and remembers what went, for the notice. */
  const settle = useCallback((w: Workspace): Workspace => {
    const r = applyRetention(w, new Date().toISOString().slice(0, 10))
    if (anyRemoved(r.removed) && w.retentionDays !== undefined) {
      const days = w.retentionDays
      setRemoved((old) => ({ days, cases: (old?.cases ?? 0) + r.removed.cases, reports: (old?.reports ?? 0) + r.removed.reports, changes: (old?.changes ?? 0) + r.removed.changes }))
    }
    return r.workspace
  }, [])

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
        note = e instanceof WorkspaceError ? t('workspace.notSaved', { message: e.message }) : t('workspace.notKept')
      }
      if (!live) return
      const settled = loaded === null ? null : settle(loaded)
      latest.current = settled ?? emptyWorkspace()
      setWorkspace(latest.current)
      setMessage(note)
      setStatus(next)
      // The period ran on a day the app was closed: keep what it did.
      if (settled !== null && settled !== loaded && next === 'ready' && store.current !== null) {
        void saveWorkspace(store.current, settled).catch(() => undefined)
      }
    })()
    return () => {
      live = false
    }
  }, [settle])

  const update = useCallback((change: (w: Workspace) => Workspace) => {
    const next = settle(change(latest.current))
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
        setMessage(t('workspace.notKept'))
      },
    )
  }, [settle])

  const dismissRemoved = useCallback(() => setRemoved(null), [])
  const value = useMemo(() => ({ workspace, status, message, update, removed, dismissRemoved }), [workspace, status, message, update, removed, dismissRemoved])
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
