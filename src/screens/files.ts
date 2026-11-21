import { markBackedUp, serializeWorkspace } from '../workspace/backup'
import type { Workspace } from '../workspace/workspace'

/** Offers text as a file download. Browser code: checked in the browser, not in Node. */
export function downloadText(fileName: string, text: string, type = 'application/json'): void {
  downloadBlob(fileName, new Blob([text], { type }))
}

/** Offers a file (a Blob) as a download. */
export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.hidden = true
  document.body.append(a)
  a.click()
  a.remove()
  // Revoke later: some browsers start the download after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** The text of a file the user chose. */
export function readText(file: File): Promise<string> {
  return file.text()
}

/** `2026-11-21` for file names. */
export const stamp = (): string => new Date().toISOString().slice(0, 10)

/** Saves a backup file of everything and remembers the day, so the reminder starts again from today. */
export function saveBackupFile(workspace: Workspace, update: (change: (w: Workspace) => Workspace) => void): void {
  const today = stamp()
  downloadText(`backup-${today}.json`, serializeWorkspace(markBackedUp(workspace, today)))
  update((w) => markBackedUp(w, today))
}

/** Asks the browser not to clear the data when it runs short of space. The browser may say no; nothing else changes. */
export function askToKeepData(): void {
  void navigator.storage?.persist?.().catch(() => undefined)
}
