import { t } from '../i18n'
import type { ChangeLogEntry, ImportPreview, StoredCase } from '../intake/import/merge'
import type { ImportedTechnician } from '../intake/map/apply'
import type { Kind } from '../intake/map/model'
import type { MappingProfile } from '../intake/map/profile'
import type { SiteProfile } from '../intake/site/site'
import { starterSite } from '../intake/site/starter'
import type { KeyValueStore } from './db'
import { readStoredReports, type StoredReport } from './reportRecords'

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
  /** Days nobody works, `YYYY-MM-DD`, sorted. */
  holidays: string[]
  /** What technicians reported about their visits, one record for each case and day. */
  reports: StoredReport[]
  /** The day the person last saved a backup file, `YYYY-MM-DD`. Absent: never. */
  lastBackupAt?: string
}

export class WorkspaceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceError'
  }
}

const KEY = 'workspace'

export function emptyWorkspace(): Workspace {
  return { workspaceVersion: 1, site: starterSite(), technicians: [], cases: [], profiles: [], changes: [], imports: [], holidays: [], reports: [] }
}

/**
 * A workspace from a stored or restored value. Data made by a newer version of the app, or damaged data, is refused
 * with a plain message. Lists that an older save did not have are filled in.
 */
export function readWorkspace(raw: unknown): Workspace {
  const damaged = new WorkspaceError(t('workspace.err.damaged'))
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw damaged
  const version = (raw as { workspaceVersion?: unknown }).workspaceVersion
  if (typeof version === 'number' && version > 1) {
    throw new WorkspaceError(t('workspace.err.newer'))
  }
  if (version !== 1) throw damaged
  return { ...emptyWorkspace(), ...(raw as Partial<Workspace>), reports: readStoredReports((raw as { reports?: unknown }).reports) }
}

/** The saved workspace, or null when nothing is saved yet. Unreadable data is refused, never overwritten. */
export async function loadWorkspace(store: KeyValueStore): Promise<Workspace | null> {
  const raw = await store.get(KEY)
  return raw === undefined ? null : readWorkspace(raw)
}

export async function saveWorkspace(store: KeyValueStore, w: Workspace): Promise<void> {
  await store.set(KEY, w)
}
