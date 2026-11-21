import { describe, expect, it } from 'vitest'
import { entryFiles, fontFiles, gzipBytes, isCompressed } from './budget.ts'

describe('entryFiles', () => {
  const html = `<!doctype html><html><head>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <script type="module" crossorigin src="/assets/index-A.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/en-B.js">
    <link rel="modulepreload" crossorigin href="/assets/en-B.js">
    <link rel="stylesheet" crossorigin href="/assets/index-C.css">
    <script src="https://elsewhere.example/x.js"></script>
    <link rel="stylesheet" href="//cdn.example/y.css">
  </head></html>`
  it('lists the script, the preloaded modules and the stylesheets of the page, once each', () => {
    expect(entryFiles(html)).toEqual(['/assets/index-A.js', '/assets/en-B.js', '/assets/index-C.css'])
  })
  it('leaves out icons, the manifest and files from other sites', () => {
    const files = entryFiles(html)
    expect(files).not.toContain('/favicon.svg')
    expect(files).not.toContain('/manifest.webmanifest')
    expect(files.some((f) => f.includes('example'))).toBe(false)
  })
  it('finds nothing in a page without assets', () => {
    expect(entryFiles('<html></html>')).toEqual([])
  })
})

describe('fontFiles', () => {
  it('lists font files, absolute or relative to the stylesheet, without queries and without other sites', () => {
    const css = `@font-face{src:url(/assets/a.woff2) format("woff2")}
      @font-face{src:url("./b.woff2?v=1") format("woff2"),url('c.woff')}
      @font-face{src:url(https://fonts.example/d.woff2)}
      .x{background:url(/assets/image.png)}`
    expect(fontFiles(css, '/assets/index.css')).toEqual(['/assets/a.woff2', '/assets/b.woff2', '/assets/c.woff'])
  })
})

describe('gzipBytes and isCompressed', () => {
  it('measures what gzip sends, so repeated text counts far less than its length', () => {
    const text = new TextEncoder().encode('visit '.repeat(2000))
    expect(gzipBytes(text)).toBeLessThan(200)
  })
  it('knows which files are sent as they are', () => {
    expect(isCompressed('/assets/a.woff2')).toBe(true)
    expect(isCompressed('/icons/x.PNG')).toBe(true)
    expect(isCompressed('/assets/a.js')).toBe(false)
  })
})
