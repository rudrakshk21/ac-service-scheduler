import { createContext, useContext } from 'react'
import type { Workspace } from './workspace'

export type StorageStatus = 'loading' | 'ready' | 'memory'

export interface WorkspaceApi {
  workspace: Workspace
  /** `memory`: the browser cannot keep the data, or saved data was left alone; changes last only for this visit. */
  status: StorageStatus
  message: string | null
  /** Applies a pure change, shows it at once and saves it. */
  update: (change: (w: Workspace) => Workspace) => void
}

export const WorkspaceContext = createContext<WorkspaceApi | null>(null)

export function useWorkspace(): WorkspaceApi {
  const api = useContext(WorkspaceContext)
  if (api === null) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return api
}
