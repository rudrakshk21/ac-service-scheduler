import { readWorkspace, WorkspaceError, type Workspace } from './workspace'

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
    throw new WorkspaceError('This file is not a backup of the app.')
  }
  return readWorkspace(raw)
}
