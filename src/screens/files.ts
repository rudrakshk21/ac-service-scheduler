/** Offers text as a file download. Browser code: checked in the browser, not in Node. */
export function downloadText(fileName: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
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
