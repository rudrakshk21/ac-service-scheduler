import { IntakeError } from '../errors'

export interface Decoded {
  text: string
  /** Lower-case encoding label, as used by `TextDecoder`. */
  encoding: string
  /** False when the encoding was guessed: the screen should show a preview and let the user pick another. */
  confident: boolean
}

function decodeWith(bytes: Uint8Array, label: string, fatal = false): string {
  return new TextDecoder(label, { fatal }).decode(bytes)
}

/**
 * Turns file bytes into text. A byte-order mark decides first (UTF-8, UTF-16 LE or BE), then strict UTF-8.
 * Bytes that are not valid UTF-8 are read as Windows-1252, and the result is marked not confident.
 * `requested` is the user's choice of encoding and is always confident.
 */
export function decodeBytes(bytes: Uint8Array, requested?: string): Decoded {
  if (requested !== undefined) {
    try {
      return { text: decodeWith(bytes, requested), encoding: requested.toLowerCase(), confident: true }
    } catch {
      throw new IntakeError('unreadable', `The text encoding "${requested}" is not known. Choose another one.`)
    }
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: decodeWith(bytes.subarray(3), 'utf-8'), encoding: 'utf-8', confident: true }
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: decodeWith(bytes.subarray(2), 'utf-16le'), encoding: 'utf-16le', confident: true }
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: decodeWith(bytes.subarray(2), 'utf-16be'), encoding: 'utf-16be', confident: true }
  }
  try {
    return { text: decodeWith(bytes, 'utf-8', true), encoding: 'utf-8', confident: true }
  } catch {
    return { text: decodeWith(bytes, 'windows-1252'), encoding: 'windows-1252', confident: false }
  }
}
