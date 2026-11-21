import type { Messages } from './core'

/**
 * Test languages made from the English messages (pseudo-localisation). Every ASCII letter is replaced, so any text that is
 * still plain English when one of them is on never went through the translation function. They also show how the layout
 * copes with longer text and with right-to-left script. Placeholders like `{name}` are kept as they are.
 */

const ACCENT = 'áƀçðéƒĝĥíĵķĺɱñóþʠŕšţúṽŵẋýž'
const VOWELS = new Set('aeiouyAEIOUY')
/** The first 26 letters of the Arabic alphabet, in order. Not meaningful words: a test script. */
const ARABIC = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.slice(0, 26)

/** Applies `change` to the text outside `{placeholders}`. */
function outsidePlaceholders(text: string, change: (piece: string) => string): string {
  return text
    .split(/(\{\w+\})/)
    .map((piece, i) => (i % 2 === 1 ? piece : change(piece)))
    .join('')
}

function mapLetters(piece: string, table: string, extra?: (c: string, mapped: string) => string): string {
  let out = ''
  for (const c of piece) {
    const lower = c.toLowerCase()
    const at = lower >= 'a' && lower <= 'z' ? lower.charCodeAt(0) - 97 : -1
    if (at < 0) {
      out += c
      continue
    }
    const mapped = c === lower ? table[at] : table[at].toUpperCase()
    out += extra === undefined ? mapped : extra(c, mapped)
  }
  return out
}

/** Accented letters, with every vowel doubled, so the text is about a third longer. */
export function pseudoAccent(text: string): string {
  return outsidePlaceholders(text, (piece) => mapLetters(piece, ACCENT, (c, mapped) => (VOWELS.has(c) ? mapped + mapped : mapped)))
}

/** Arabic letters in place of Latin ones, to see the layout mirrored. Digits and punctuation stay. */
export function pseudoRtl(text: string): string {
  return outsidePlaceholders(text, (piece) => mapLetters(piece, ARABIC))
}

export function pseudoMessages(source: Messages, mode: 'accent' | 'rtl'): Messages {
  const change = mode === 'accent' ? pseudoAccent : pseudoRtl
  return Object.fromEntries(Object.entries(source).map(([key, text]) => [key, change(text)]))
}
