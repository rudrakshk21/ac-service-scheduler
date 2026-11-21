import { dayNumber } from '../engine/calendar'
import { t } from '../i18n'
import { readWorkspace, WorkspaceError, type Workspace } from './workspace'

/** The data lives only in this browser, so a backup is suggested after this many days without one. */
const BACKUP_AFTER_DAYS = 14

/** Remembers that a backup was saved today. Nothing else changes. */
export function markBackedUp(w: Workspace, today: string): Workspace {
  return { ...w, lastBackupAt: today }
}

/**
 * Whether to suggest a backup, and how many days it has been. Counts from the last backup, or from the first import
 * when there has never been one. Nothing imported means nothing to lose.
 */
export function backupDue(w: Workspace, today: string): { due: boolean; days: number } {
  const firstImport = w.imports.map((i) => i.at).sort()[0]
  const since = w.imports.length === 0 ? undefined : (w.lastBackupAt ?? firstImport)
  if (since === undefined) return { due: false, days: 0 }
  const days = dayNumber(today) - dayNumber(since)
  return { due: days >= BACKUP_AFTER_DAYS, days }
}

/** A backup of everything in the app, as a JSON file the user can keep. It contains case data. */
export function serializeWorkspace(w: Workspace): string {
  return JSON.stringify(w, null, 2) + '\n'
}

/** Reads a backup. Throws a `WorkspaceError` with a plain message when it cannot be used. */
export function parseWorkspace(text: string): Workspace {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new WorkspaceError(t('workspace.err.notBackup'))
  }
  return readWorkspace(raw)
}
