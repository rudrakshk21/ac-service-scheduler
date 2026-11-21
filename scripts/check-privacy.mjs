// Fails when a file that is committed to git holds something personal: a path on somebody's computer, an email address
// of a person, a cloud-drive folder. Real data stays in the git-ignored folder reference-local/ and never enters git.
// Usage: npm run check:privacy
// (Node strips the types of the imported .ts file itself.)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { privacyFindings } from '../vite-plugins/privacy.ts'

// Not text, or the check's own rules and tests, which have to hold examples of what it looks for.
const SKIP = /(?:\.(?:png|jpe?g|gif|ico|woff2?|webp|zip)|package-lock\.json|^vite-plugins\/privacy(?:\.test)?\.ts)$/i

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter((f) => f !== '' && !SKIP.test(f))
let count = 0
for (const file of files) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue // listed by git but not on disk (deleted, not yet committed)
  }
  for (const f of privacyFindings(text)) {
    count += 1
    console.error(`${file}:${f.line}  ${f.kind}: ${f.text}`)
  }
}
if (count > 0) {
  console.error(`\n${count} place(s) in committed files look personal. Remove them, or keep the file out of git (see .gitignore).`)
  process.exit(1)
}
console.log(`ok  ${files.length} committed files checked: no local paths, personal email addresses or cloud folders.`)
