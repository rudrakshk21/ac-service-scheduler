import { downloadBlob } from '../screens/files'

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

/**
 * Hands a file to the phone's share sheet when it has one (FR-28.6), otherwise saves it as a download.
 * Browser code: checked in a browser, not in Node.
 */
export async function shareOrDownload(fileName: string, content: string | Blob, type: string): Promise<ShareOutcome> {
  const file = new File([content], fileName, { type })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName })
      return 'shared'
    } catch (e) {
      // Closing the share sheet is not an error and must not start a download.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    }
  }
  downloadBlob(fileName, file)
  return 'downloaded'
}
