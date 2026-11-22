import { downloadBlob } from '../screens/files'

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

/** Another file name and type to offer the same content under, when the share sheet refuses the first. */
export interface ShareAs {
  fileName: string
  type: string
}

/**
 * Hands a file to the phone's share sheet when it has one (FR-28.6), otherwise saves it as a download.
 *
 * Chrome on Android only lets certain kinds of file through the share sheet (images, PDF, plain text, CSV, and the
 * like), so a `.json` or `.xlsx` file is refused. `alternative` is the same content under a name and type that is
 * allowed (a route pack as plain text); it is tried next. The download always keeps the file's own name.
 * Browser code: checked in a browser, not in Node.
 */
export async function shareOrDownload(fileName: string, content: string | Blob, type: string, alternative?: ShareAs): Promise<ShareOutcome> {
  const file = new File([content], fileName, { type })
  const forms = alternative === undefined ? [file] : [file, new File([content], alternative.fileName, { type: alternative.type })]
  for (const form of forms) {
    if (typeof navigator.canShare !== 'function' || !navigator.canShare({ files: [form] })) continue
    try {
      await navigator.share({ files: [form], title: form.name })
      return 'shared'
    } catch (e) {
      // Closing the share sheet is not an error and must not start a download.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    }
  }
  downloadBlob(fileName, file)
  return 'downloaded'
}
