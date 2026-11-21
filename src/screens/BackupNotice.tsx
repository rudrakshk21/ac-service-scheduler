import { useState } from 'react'
import { backupDue } from '../workspace/backup'
import { useWorkspace } from '../workspace/useWorkspace'
import { saveBackupFile } from './files'

/** A quiet reminder when the data has gone two weeks without a backup. It comes back the next time the app is opened. */
export function BackupNotice() {
  const { workspace, update } = useWorkspace()
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [hidden, setHidden] = useState(false)
  const { due, days } = backupDue(workspace, today)
  if (!due || hidden) return null
  return (
    <p className="banner row" role="status">
      <span>You have not saved a backup for {days} days. Your data lives only in this browser.</span>
      <button type="button" className="btn" onClick={() => saveBackupFile(workspace, update)}>Save a backup</button>
      <button type="button" className="btn" onClick={() => setHidden(true)}>Later</button>
    </p>
  )
}
