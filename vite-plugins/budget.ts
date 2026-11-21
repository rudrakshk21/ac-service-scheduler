import { posix } from 'node:path'
import { gzipSync } from 'node:zlib'

/** The files a first visit loads from the page itself: its script, its preloaded modules and its stylesheets. */
export function entryFiles(html: string): string[] {
  const out: string[] = []
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) ?? []) {
    const isScript = /^<script/i.test(tag)
    const rel = /\brel="([^"]*)"/i.exec(tag)?.[1]
    if (!isScript && rel !== 'modulepreload' && rel !== 'stylesheet') continue
    const ref = /\b(?:src|href)="([^"]+)"/i.exec(tag)?.[1]
    if (ref !== undefined && ref.startsWith('/') && !ref.startsWith('//')) out.push(ref)
  }
  return [...new Set(out)]
}

/** The font files a stylesheet names, as absolute paths on the site (`cssPath` is where the stylesheet itself lives). */
export function fontFiles(css: string, cssPath: string): string[] {
  const out: string[] = []
  for (const m of css.matchAll(/url\(\s*["']?([^"')\s]+\.woff2?)(?:[?#][^"')\s]*)?["']?\s*\)/gi)) {
    const ref = m[1]
    if (/^(?:[a-z]+:|\/\/)/i.test(ref)) continue
    out.push(ref.startsWith('/') ? ref : posix.join(posix.dirname(cssPath), ref))
  }
  return [...new Set(out)]
}

/** Size of the bytes as a server sends them with gzip, the unit the requirement is written in. */
export function gzipBytes(bytes: Uint8Array): number {
  return gzipSync(bytes, { level: 9 }).length
}

/** Files that are already compressed: sent as they are, so their own size counts. */
export function isCompressed(path: string): boolean {
  return /\.(?:woff2?|png|jpe?g|webp|avif|gif|ico|zip)$/i.test(path)
}
