import { describe, expect, it } from 'vitest'
import type { Table } from './tables'
import { toXlsx } from './xlsx'

async function sheetsOf(blob: Blob): Promise<{ sheet: string; data: unknown[][] }[]> {
  const { default: read } = await import('read-excel-file/universal')
  return (await read(new Uint8Array(await blob.arrayBuffer()))) as { sheet: string; data: unknown[][] }[]
}

const tables: Table[] = [
  { id: 'schedule', name: 'Schedule', headers: ['Case', 'Visit', 'Reason'], rows: [['A-1', 1, 'First'], ['=1+1', 2, 'Second'], ['@x', 3, '']] },
  { id: 'dayRoutes', name: 'Day routes', headers: ['Date', 'Stops in order'], rows: [['2026-10-13', 'A-1 > B-2']] },
  { id: 'summary', name: 'Empty', headers: ['One', 'Two'], rows: [] },
]

describe('toXlsx', () => {
  it('writes one sheet per table, named after it, with the header row first', async () => {
    const sheets = await sheetsOf(await toXlsx(tables))
    expect(sheets.map((s) => s.sheet)).toEqual(['Schedule', 'Day routes', 'Empty'])
    expect(sheets[0].data[0]).toEqual(['Case', 'Visit', 'Reason'])
    expect(sheets[1].data).toEqual([['Date', 'Stops in order'], ['2026-10-13', 'A-1 > B-2']])
    expect(sheets[2].data[0]).toEqual(['One', 'Two'])
  })

  it('keeps numbers as numbers and text as text', async () => {
    const sheet = (await sheetsOf(await toXlsx(tables)))[0]
    expect(sheet.data[1][1]).toBe(1)
    expect(typeof sheet.data[1][0]).toBe('string')
  })

  it('puts an apostrophe before text that a spreadsheet could run as a formula (SEC-5)', async () => {
    const sheet = (await sheetsOf(await toXlsx(tables)))[0]
    expect(sheet.data[2][0]).toBe("'=1+1")
    expect(sheet.data[3][0]).toBe("'@x")
  })

  it('is a real Excel file: a zip that starts with PK', async () => {
    const blob = await toXlsx(tables)
    const head = new Uint8Array(await blob.arrayBuffer()).slice(0, 2)
    expect(String.fromCharCode(head[0], head[1])).toBe('PK')
    expect(blob.size).toBeGreaterThan(1000)
  })
})
