/**
 * Parses delimited text into rows of strings. Handles quoted cells, doubled quotes, line breaks inside cells and
 * `\r\n`, `\n` or `\r` row ends. A trailing newline adds no row. A quote inside an unquoted cell is kept as it is.
 */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let started = false
  let i = 0
  const n = text.length
  while (i < n) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        quoted = false
        i += 1
        continue
      }
      cell += ch
      i += 1
      continue
    }
    if (ch === '"' && cell === '') {
      quoted = true
      started = true
      i += 1
      continue
    }
    if (ch === delimiter) {
      row.push(cell)
      cell = ''
      started = true
      i += 1
      continue
    }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      i += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      started = false
      continue
    }
    cell += ch
    started = true
    i += 1
  }
  if (started || cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/** Writes rows as delimited text, quoting where needed. Always ends with a newline. */
export function serializeCsv(rows: string[][], delimiter: string): string {
  const quote = (cell: string): string =>
    cell.includes(delimiter) || cell.includes('"') || cell.includes('\n') || cell.includes('\r')
      ? `"${cell.replaceAll('"', '""')}"`
      : cell
  return rows.map((r) => r.map(quote).join(delimiter) + '\n').join('')
}

const CANDIDATES = [',', ';', '\t', '|']
const SAMPLE_CHARS = 65536
const SAMPLE_ROWS = 50

/**
 * Picks the delimiter that gives the most consistent column count over the first rows (at least two columns).
 * Not confident when no delimiter is clearly best; the user then picks.
 */
export function detectDelimiter(text: string): { delimiter: string; confident: boolean } {
  const cut = text.length > SAMPLE_CHARS
  const sample = cut ? text.slice(0, SAMPLE_CHARS) : text
  const scored = CANDIDATES.map((delimiter) => {
    let rows = parseCsv(sample, delimiter)
    if (cut) rows = rows.slice(0, -1)
    rows = rows.filter((r) => !(r.length === 1 && r[0].trim() === '')).slice(0, SAMPLE_ROWS)
    if (rows.length === 0) return { delimiter, score: 0, modal: 0 }
    const counts = new Map<number, number>()
    for (const r of rows) counts.set(r.length, (counts.get(r.length) ?? 0) + 1)
    let modal = 0
    let best = 0
    for (const [len, count] of counts) {
      if (count > best || (count === best && len > modal)) {
        best = count
        modal = len
      }
    }
    return { delimiter, score: modal >= 2 ? best / rows.length : 0, modal }
  })
  scored.sort((a, b) => b.score - a.score || b.modal - a.modal)
  const [first, second] = scored
  if (first.score === 0) return { delimiter: ',', confident: false }
  const confident = first.score >= 0.9 && (second.score < 0.9 || first.modal > second.modal)
  return { delimiter: first.delimiter, confident }
}
