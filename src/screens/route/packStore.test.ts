import { describe, expect, it } from 'vitest'
import { memoryStore } from '../../workspace/db'
import type { RoutePack } from '../../share/routePack'
import { addPack, loadPacks, MAX_PACKS, removePack, savePacks } from './packStore'

const pack = (technician: string, date: string, createdAt = '2026-10-13T10:00:00.000Z'): RoutePack => ({
  packVersion: 1, site: 'Test centre', technician, date, createdAt, validFor: date,
  stops: [{ visit: 1, caseId: 'A-1', workType: 'Service', place: 'North', lat: 20.1, lon: 30.05, arrival: '09:30', kilometres: 3.2, drivingMinutes: 8 }],
})

describe('addPack', () => {
  it('puts the newest pack first', () => {
    const a = pack('Asha', '2026-10-13', '2026-10-13T08:00:00.000Z')
    const b = pack('Bo', '2026-10-13', '2026-10-13T09:00:00.000Z')
    expect(addPack([a], b).map((p) => p.technician)).toEqual(['Bo', 'Asha'])
    expect(addPack([b], a).map((p) => p.technician)).toEqual(['Bo', 'Asha'])
  })
  it('replaces the pack for the same technician and date, so a new file after a re-plan wins', () => {
    const old = pack('Asha', '2026-10-13', '2026-10-13T08:00:00.000Z')
    const next = { ...pack('Asha', '2026-10-13', '2026-10-13T12:00:00.000Z'), site: 'Newer' }
    const list = addPack([old, pack('Bo', '2026-10-13')], next)
    expect(list).toHaveLength(2)
    expect(list.find((p) => p.technician === 'Asha')?.site).toBe('Newer')
  })
  it('keeps a pack for another date of the same technician', () => {
    expect(addPack([pack('Asha', '2026-10-13')], pack('Asha', '2026-10-14'))).toHaveLength(2)
  })
  it('keeps at most 20, dropping the oldest', () => {
    let list: RoutePack[] = []
    for (let i = 0; i < MAX_PACKS + 5; i++) {
      list = addPack(list, pack(`Tech ${i}`, '2026-10-13', `2026-10-13T10:${String(i).padStart(2, '0')}:00.000Z`))
    }
    expect(list).toHaveLength(MAX_PACKS)
    expect(list[0].technician).toBe(`Tech ${MAX_PACKS + 4}`)
    expect(list.map((p) => p.technician)).not.toContain('Tech 0')
  })
  it('does not change the list it was given', () => {
    const list = [pack('Asha', '2026-10-13')]
    addPack(list, pack('Bo', '2026-10-13'))
    expect(list).toHaveLength(1)
  })
})

describe('removePack', () => {
  it('removes the pack of one technician and date, and no other', () => {
    const list = [pack('Asha', '2026-10-13'), pack('Asha', '2026-10-14'), pack('Bo', '2026-10-13')]
    expect(removePack(list, 'Asha', '2026-10-13').map((p) => `${p.technician} ${p.date}`)).toEqual(['Asha 2026-10-14', 'Bo 2026-10-13'])
  })
})

describe('loadPacks and savePacks', () => {
  it('start empty and keep what was saved', async () => {
    const store = memoryStore()
    expect(await loadPacks(store)).toEqual([])
    const list = [pack('Asha', '2026-10-13'), pack('Bo', '2026-10-14')]
    await savePacks(store, list)
    expect(await loadPacks(store)).toEqual(list)
  })
  it('drop a damaged entry instead of showing it or failing', async () => {
    const store = memoryStore()
    const good = pack('Asha', '2026-10-13')
    await store.set('routePacks', [good, { packVersion: 1, technician: 'Broken' }, 'not a pack', null])
    expect(await loadPacks(store)).toEqual([good])
  })
  it('treat something that is not a list as no packs', async () => {
    const store = memoryStore()
    await store.set('routePacks', { oops: true })
    expect(await loadPacks(store)).toEqual([])
  })
  it('remove every field a pack must not have when it is read back', async () => {
    const store = memoryStore()
    await store.set('routePacks', [{ ...pack('Asha', '2026-10-13'), customerName: 'Someone' }])
    expect(JSON.stringify(await loadPacks(store))).not.toContain('Someone')
  })
})
