// Fails when the built app (dist/) grows past its size budget. Usage: npm run build && npm run check:size
//   First download: the page, its scripts and stylesheets (gzip) plus the fonts they name. Requirement NFR-3: 300 KB.
//   Install: every file of the app, the one-time download that makes it work offline. Our own guard against creep.
// (Node strips the types of the imported .ts file itself.)
import { readFile, readdir } from 'node:fs/promises'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { entryFiles, fontFiles, gzipBytes, isCompressed } from '../vite-plugins/budget.ts'

const KB = 1024
const FIRST_DOWNLOAD_LIMIT = 300 * KB
const INSTALL_LIMIT = 800 * KB

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const kb = (bytes) => `${(bytes / KB).toFixed(1)} KB`

/** What the file costs to download: gzip for text, its own size for files that are already compressed. */
async function cost(path) {
  const bytes = await readFile(join(dist, path))
  return isCompressed(path) ? bytes.length : gzipBytes(bytes)
}

async function* walk(dir, prefix = '') {
  for (const entry of await readdir(join(dist, dir), { withFileTypes: true })) {
    const path = posix.join(prefix, entry.name)
    if (entry.isDirectory()) yield* walk(join(dir, entry.name), path)
    else yield '/' + path
  }
}

let html
try {
  html = await readFile(join(dist, 'index.html'), 'utf8')
} catch {
  console.error('dist/index.html is missing. Run `npm run build` first.')
  process.exit(2)
}

const first = new Set(['/index.html', ...entryFiles(html)])
for (const file of [...first]) {
  if (file.endsWith('.css')) for (const font of fontFiles(await readFile(join(dist, file), 'utf8'), file)) first.add(font)
}
let firstTotal = 0
for (const file of first) {
  const bytes = await cost(file)
  firstTotal += bytes
  console.log(`  ${kb(bytes).padStart(10)}  ${file}`)
}

let installTotal = 0
for await (const file of walk('')) installTotal += await cost(file)

const rows = [
  ['First download', firstTotal, FIRST_DOWNLOAD_LIMIT],
  ['Install (all files)', installTotal, INSTALL_LIMIT],
]
let failed = false
console.log('')
for (const [name, total, limit] of rows) {
  const over = total > limit
  failed ||= over
  console.log(`${over ? 'FAIL' : 'ok  '}  ${name}: ${kb(total)} of ${kb(limit)} (${Math.round((total / limit) * 100)}%)`)
}
if (failed) {
  console.error('\nThe app grew past its size budget. Find what was added (`npm run build` lists the chunk sizes), load it lazily, or drop it.')
  process.exit(1)
}
