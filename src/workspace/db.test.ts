import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { memoryStore, openIndexedStore, type KeyValueStore } from './db'

const value = { a: 1, list: ['x', { y: new Date(Date.UTC(2026, 9, 13)) }], nested: { ok: true } }

async function behaves(store: KeyValueStore): Promise<void> {
  expect(await store.get('missing')).toBeUndefined()
  await store.set('k', value)
  expect(await store.get('k')).toEqual(value)
  const copy = (await store.get('k')) as typeof value
  copy.a = 99 // a read returns a copy, not the stored object
  expect(((await store.get('k')) as typeof value).a).toBe(1)
  await store.set('k', { a: 2 })
  expect(await store.get('k')).toEqual({ a: 2 })
  await store.delete('k')
  expect(await store.get('k')).toBeUndefined()
}

describe('memoryStore', () => {
  it('stores copies, replaces and deletes', async () => {
    await behaves(memoryStore())
  })
})

describe('openIndexedStore', () => {
  it('stores copies, replaces and deletes', async () => {
    await behaves(await openIndexedStore('t1', new IDBFactory()))
  })
  it('keeps data when the database is opened again', async () => {
    const factory = new IDBFactory()
    await (await openIndexedStore('t2', factory)).set('k', value)
    expect(await (await openIndexedStore('t2', factory)).get('k')).toEqual(value)
  })
  it('keeps databases of different names apart', async () => {
    const factory = new IDBFactory()
    await (await openIndexedStore('one', factory)).set('k', 1)
    expect(await (await openIndexedStore('two', factory)).get('k')).toBeUndefined()
  })
  it('says so plainly when the browser has no storage', async () => {
    await expect(openIndexedStore('t3', undefined)).rejects.toThrow('no local storage')
  })
  it('turns a failure to open into an error', async () => {
    const broken = { open: () => { throw new Error('denied') } } as unknown as IDBFactory
    await expect(openIndexedStore('t4', broken)).rejects.toThrow('denied')
  })
})
