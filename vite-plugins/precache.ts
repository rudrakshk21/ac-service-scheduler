import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { Plugin } from 'vite'

/** Files that are not part of the app itself. */
const SKIP = new Set(['sw.js', '_headers'])

/** The files of a finished build, relative to `dir`, with forward slashes, sorted. */
export function listFiles(dir: string): string[] {
  const found: string[] = []
  const walk = (folder: string): void => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const full = join(folder, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      const rel = relative(dir, full).split(sep).join('/')
      if (!SKIP.has(rel) && !rel.endsWith('.map')) found.push(rel)
    }
  }
  walk(dir)
  return found.sort()
}

/** The addresses the worker stores: the start address, the page and every file. */
export function urlsFor(files: string[]): string[] {
  return ['/', '/index.html', ...files.filter((f) => f !== 'index.html').map((f) => '/' + f)]
}

/** A short name for this build: the same files with the same content always give the same name. */
export function versionOf(entries: { file: string; hash: string }[]): string {
  const sum = createHash('sha256')
  for (const e of [...entries].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))) sum.update(`${e.file}\0${e.hash}\0`)
  return sum.digest('hex').slice(0, 12)
}

/** The worker file: the template with its two markers filled in. A template without a marker is an error. */
export function swSource(template: string, version: string, urls: string[]): string {
  for (const marker of ['__VERSION__', '__FILES__']) {
    if (!template.includes(marker)) throw new Error(`The service worker template has no ${marker} marker.`)
  }
  return template.replace('__VERSION__', () => version).replace('__FILES__', () => JSON.stringify(urls))
}

/** After the build, writes `sw.js` next to the other files, listing all of them so the app opens offline. */
export function precache(): Plugin {
  let root = process.cwd()
  let outDir = join(root, 'dist')
  return {
    name: 'precache-service-worker',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = join(config.root, config.build.outDir)
    },
    closeBundle() {
      const files = listFiles(outDir)
      const entries = files.map((file) => ({ file, hash: createHash('sha256').update(readFileSync(join(outDir, file))).digest('hex') }))
      const template = readFileSync(join(root, 'vite-plugins', 'sw-template.js'), 'utf8')
      writeFileSync(join(outDir, 'sw.js'), swSource(template, versionOf(entries), urlsFor(files)))
    },
  }
}
