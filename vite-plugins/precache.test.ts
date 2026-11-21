import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listFiles, swSource, urlsFor, versionOf } from './precache.ts'

describe('urlsFor', () => {
  it('lists the page, the start address and every file with a leading slash', () => {
    expect(urlsFor(['assets/a.js', 'favicon.svg'])).toEqual(['/', '/index.html', '/assets/a.js', '/favicon.svg'])
  })
  it('does not list index.html twice', () => {
    expect(urlsFor(['index.html', 'a.js'])).toEqual(['/', '/index.html', '/a.js'])
  })
})

describe('versionOf', () => {
  const a = { file: 'a.js', hash: '1111' }
  const b = { file: 'b.css', hash: '2222' }
  it('is 12 hex characters', () => {
    expect(versionOf([a, b])).toMatch(/^[0-9a-f]{12}$/)
  })
  it('does not depend on the order of the files', () => {
    expect(versionOf([a, b])).toBe(versionOf([b, a]))
  })
  it('changes when one file changes, or when a file is added or renamed', () => {
    const base = versionOf([a, b])
    expect(versionOf([a, { ...b, hash: '3333' }])).not.toBe(base)
    expect(versionOf([a])).not.toBe(base)
    expect(versionOf([a, { ...b, file: 'c.css' }])).not.toBe(base)
  })
})

describe('swSource', () => {
  const template = "const VERSION = '__VERSION__'\nconst FILES = __FILES__\nconsole.log(VERSION, FILES.length)\n"
  it('fills in the version and the list of files', () => {
    const out = swSource(template, 'abc123abc123', ['/', '/a.js'])
    expect(out).toContain("const VERSION = 'abc123abc123'")
    expect(out).toContain('const FILES = ["/","/a.js"]')
    expect(out).not.toContain('__')
  })
  it('produces JavaScript that parses', () => {
    expect(() => new Function(swSource(template, 'v', ['/x"y']))).not.toThrow()
  })
  it('refuses a template that lacks a marker, so a broken worker is never written', () => {
    expect(() => swSource('const FILES = __FILES__', 'v', [])).toThrow('__VERSION__')
    expect(() => swSource("const VERSION = '__VERSION__'", 'v', [])).toThrow('__FILES__')
  })
})

describe('listFiles', () => {
  it('lists nested files with forward slashes and leaves out the worker, the headers file and source maps', () => {
    const dir = mkdtempSync(join(tmpdir(), 'precache-'))
    mkdirSync(join(dir, 'assets'))
    mkdirSync(join(dir, 'icons'))
    for (const f of ['index.html', 'sw.js', '_headers', 'assets/app.js', 'assets/app.js.map', 'icons/i.png']) writeFileSync(join(dir, f), f)
    expect(listFiles(dir)).toEqual(['assets/app.js', 'icons/i.png', 'index.html'])
  })
})
