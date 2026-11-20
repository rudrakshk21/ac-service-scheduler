import { describe, expect, it } from 'vitest'
import { IntakeError } from '../errors'
import { decodeBytes } from './encoding'

const utf8 = (s: string) => new TextEncoder().encode(s)
function utf16(s: string, littleEndian: boolean, bom: boolean): Uint8Array {
  const out: number[] = bom ? (littleEndian ? [0xff, 0xfe] : [0xfe, 0xff]) : []
  for (const ch of s) {
    const code = ch.charCodeAt(0)
    out.push(...(littleEndian ? [code & 255, code >> 8] : [code >> 8, code & 255]))
  }
  return Uint8Array.from(out)
}

describe('decodeBytes', () => {
  it('reads UTF-8 with a byte-order mark and drops the mark', () => {
    const bytes = Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8('Id;Ort\n')])
    expect(decodeBytes(bytes)).toEqual({ text: 'Id;Ort\n', encoding: 'utf-8', confident: true })
  })
  it('reads UTF-8 without a mark, including non-ASCII and plain ASCII', () => {
    expect(decodeBytes(utf8('café 日本'))).toEqual({ text: 'café 日本', encoding: 'utf-8', confident: true })
    expect(decodeBytes(utf8('plain'))).toEqual({ text: 'plain', encoding: 'utf-8', confident: true })
  })
  it('reads UTF-16 little and big endian with a mark', () => {
    expect(decodeBytes(utf16('Id\tÅrea', true, true))).toEqual({ text: 'Id\tÅrea', encoding: 'utf-16le', confident: true })
    expect(decodeBytes(utf16('Id\tÅrea', false, true))).toEqual({ text: 'Id\tÅrea', encoding: 'utf-16be', confident: true })
  })
  it('falls back to Windows-1252 for bytes that are not UTF-8 and says it is a guess', () => {
    const bytes = Uint8Array.from([0x4f, 0x72, 0x74, 0x20, 0xe9]) // "Ort é" in Windows-1252
    expect(decodeBytes(bytes)).toEqual({ text: 'Ort é', encoding: 'windows-1252', confident: false })
  })
  it('uses the encoding the user chose, and is confident about it', () => {
    const bytes = Uint8Array.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]) // "Привет" in Windows-1251
    expect(decodeBytes(bytes, 'windows-1251')).toEqual({ text: 'Привет', encoding: 'windows-1251', confident: true })
  })
  it('names an unknown encoding in the error', () => {
    expect(() => decodeBytes(utf8('x'), 'not-an-encoding')).toThrow(IntakeError)
    expect(() => decodeBytes(utf8('x'), 'not-an-encoding')).toThrow('not-an-encoding')
  })
  it('reads empty bytes as empty text', () => {
    expect(decodeBytes(new Uint8Array(0)).text).toBe('')
  })
})
