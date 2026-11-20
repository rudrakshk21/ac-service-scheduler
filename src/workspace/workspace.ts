import type { ChangeLogEntry, ImportPreview, StoredCase } from '../intake/import/merge'
import type { ImportedTechnician } from '../intake/map/apply'
import type { Kind } from '../intake/map/model'
import type { MappingProfile } from '../intake/map/profile'
import type { SiteProfile } from '../intake/site/site'
import { starterSite } from '../intake/site/starter'
import type { KeyValueStore } from './db'

export interface ImportRecord {
  /** `YYYY-MM-DD`. */
  at: string
  fileName: string
  kind: Kind
  preview: ImportPreview
}

/** Everything the user has set up and imported. Kept in the browser, in one value. */
export interface Workspace {
  workspaceVersion: 1
  site: SiteProfile
  technicians: ImportedTechnician[]
  cases: StoredCase[]
  /** Saved mappings, one per kind and file layout. */
  profiles: MappingProfile[]
  /** Every change an import made, oldest first. */
  changes: ChangeLogEntry[]
  imports: ImportRecord[]
}

export class WorkspaceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceError'
  }
}

const KEY = 'workspace'

export function emptyWorkspace(): Workspace {
  return { workspaceVersion: 1, site: starterSite(), technicians: [], cases: [], profiles: [], changes: [], imports: [] }
}

/**
 * The saved workspace, or null when nothing is saved yet. Data saved by a newer version of the app, or damaged data,
 * is not opened and not overwritten: the error says so in plain words.
 */
export async function loadWorkspace(store: KeyValueStore): Promise<Workspace | null> {
  const raw = await store.get(KEY)
  if (raw === undefined) return null
  const damaged = new WorkspaceError('The saved data is damaged, so it was not opened and has not been changed.')
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw damaged
  const version = (raw as { workspaceVersion?: unknown }).workspaceVersion
  if (typeof version === 'number' && version > 1) {
    throw new WorkspaceError('The saved data was made by a newer version of the app, so it was not opened and has not been changed.')
  }
  if (version !== 1) throw damaged
  return { ...emptyWorkspace(), ...(raw as Partial<Workspace>) }
}

export async function saveWorkspace(store: KeyValueStore, w: Workspace): Promise<void> {
  await store.set(KEY, w)
}
