import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { headersFor, parseHeaders } from './headers.ts'

describe('parseHeaders and headersFor', () => {
  const rules = parseHeaders('/*\n  X-One: 1\n\n/a.js\n  Cache-Control: no-cache\n  X-One: 2\n\n/assets/*\n  X-Assets: yes\n')

  it('reads each path with its header lines', () => {
    expect(rules.map((r) => r.pattern)).toEqual(['/*', '/a.js', '/assets/*'])
    expect(rules[1].headers).toEqual([['Cache-Control', 'no-cache'], ['X-One', '2']])
  })
  it('applies the rules that match a path, a folder pattern to the files in it, and joins repeated headers', () => {
    expect(headersFor(rules, '/a.js')).toEqual({ 'X-One': '1, 2', 'Cache-Control': 'no-cache' })
    expect(headersFor(rules, '/assets/x.js')).toEqual({ 'X-One': '1', 'X-Assets': 'yes' })
    expect(headersFor(rules, '/other')).toEqual({ 'X-One': '1' })
  })
  it('keeps a colon inside a value', () => {
    expect(parseHeaders('/x\n  Content-Security-Policy: default-src \'self\'; connect-src https://a:443\n')[0].headers[0][1]).toBe("default-src 'self'; connect-src https://a:443")
  })
  it('reads Windows line ends', () => {
    expect(parseHeaders('/x\r\n  A: 1\r\n')[0].headers).toEqual([['A', '1']])
  })
})

describe('the real security headers of the site (public/_headers)', () => {
  const all = headersFor(parseHeaders(readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')), '/index.html')
  const csp = Object.fromEntries((all['Content-Security-Policy'] ?? '').split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0] !== '').map(([name, ...values]) => [name, values]))

  it('allows nothing by default, and only the site itself for scripts, styles, fonts, images, workers and requests', () => {
    expect(csp['default-src']).toEqual(["'none'"])
    for (const directive of ['script-src', 'style-src', 'font-src', 'img-src', 'connect-src', 'worker-src', 'manifest-src']) {
      expect(csp[directive], directive).toEqual(["'self'"])
    }
  })
  it('never allows inline or evaluated script, or any other site', () => {
    const text = all['Content-Security-Policy']
    expect(text).not.toMatch(/unsafe-inline|unsafe-eval|https?:|\*/)
  })
  it('forbids framing, a changed base address and form posts', () => {
    expect(csp['frame-ancestors']).toEqual(["'none'"])
    expect(csp['base-uri']).toEqual(["'none'"])
    expect(csp['form-action']).toEqual(["'none'"])
  })
  it('sends the other protective headers', () => {
    expect(all['X-Content-Type-Options']).toBe('nosniff')
    expect(all['Referrer-Policy']).toBe('no-referrer')
    expect(all['Cross-Origin-Opener-Policy']).toBe('same-origin')
    expect(all['Strict-Transport-Security']).toMatch(/max-age=\d{7,}/)
    expect(all['Permissions-Policy']).toContain('geolocation=(self)')
    expect(all['Permissions-Policy']).toContain('camera=()')
  })
  it('keeps the page, the worker and the manifest from being cached stale', () => {
    const rules = parseHeaders(readFileSync(new URL('../public/_headers', import.meta.url), 'utf8'))
    expect(headersFor(rules, '/sw.js')['Cache-Control']).toBe('no-cache')
    expect(headersFor(rules, '/index.html')['Cache-Control']).toBe('no-cache')
    expect(headersFor(rules, '/manifest.webmanifest')['Content-Type']).toBe('application/manifest+json')
  })
})
