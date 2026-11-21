import type { Cell, Table } from './tables'

/**
 * SEC-5: a spreadsheet runs text that starts with `=`, `+`, `-` or `@` (also a tab or a carriage return) as a formula.
 * An apostrophe in front keeps it text. Numbers are numbers and are left alone.
 */
export function neutralise(cell: Cell): Cell {
  return typeof cell === 'string' && /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell
}

function field(cell: Cell): string {
  const text = String(neutralise(cell))
  return /[",\r\n]/.test(text) || /^\s|\s$/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** A CSV file for one table. The byte-order mark makes Excel read it as UTF-8; lines end with CRLF. */
export function toCsv(table: Table): string {
  const lines = [table.headers, ...table.rows].map((row) => row.map(field).join(','))
  return '﻿' + lines.join('\r\n') + '\r\n'
}
