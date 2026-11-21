/** Something in a file that should not be published: where it is, what kind, and the text found. */
export interface Finding {
  line: number
  kind: 'local path' | 'email address' | 'cloud folder'
  text: string
}

/** Addresses that are not a person's: the attribution lines, GitHub's no-reply addresses, and made-up ones. */
const HARMLESS_EMAIL = /(?:^noreply@anthropic\.com$|@users\.noreply\.github\.com$|@(?:[a-z0-9-]+\.)*(?:example\.(?:com|org|net)|invalid|test|localhost)$)/i

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g
// A drive letter and Users, or /Users/name/ or /home/name/: a path on somebody's own computer.
const LOCAL_PATH = /(?:\b[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s'"`]+|(?:^|[\s'"`=(])\/(?:Users|home)\/[A-Za-z0-9._-]+\/)/
const CLOUD_FOLDER = /\bOneDrive(?: - [^\\/\n]+)?\b|\bGoogle Drive\b[\\/]|\bDropbox[\\/]/

/** What in a text file looks personal or private: paths on a person's computer, email addresses, cloud-drive folders. */
export function privacyFindings(text: string): Finding[] {
  const out: Finding[] = []
  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    const path = LOCAL_PATH.exec(line)
    if (path !== null) out.push({ line: i + 1, kind: 'local path', text: path[0].trim() })
    const cloud = CLOUD_FOLDER.exec(line)
    if (cloud !== null) out.push({ line: i + 1, kind: 'cloud folder', text: cloud[0] })
    for (const m of line.matchAll(EMAIL)) {
      if (!HARMLESS_EMAIL.test(m[0])) out.push({ line: i + 1, kind: 'email address', text: m[0] })
    }
  })
  return out
}
