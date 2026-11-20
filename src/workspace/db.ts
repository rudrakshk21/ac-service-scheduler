/** A very small key-value store. The workspace is kept in one value, so two methods and a delete are enough. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
}

/** A store that lives only in memory: for tests, and for the session when the browser refuses to keep data. */
export function memoryStore(): KeyValueStore {
  const data = new Map<string, unknown>()
  return {
    get: (key) => Promise.resolve(data.has(key) ? structuredClone(data.get(key)) : undefined),
    set: (key, value) => {
      data.set(key, structuredClone(value))
      return Promise.resolve()
    },
    delete: (key) => {
      data.delete(key)
      return Promise.resolve()
    },
  }
}

const STORE = 'kv'

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error ?? new Error('The browser storage failed.'))
  })
}

/** The browser's IndexedDB as a key-value store. Rejects with a plain error when storage is blocked or unavailable. */
export function openIndexedStore(name = 'ac-scheduler', factory: IDBFactory | undefined = globalThis.indexedDB): Promise<KeyValueStore> {
  return new Promise((resolve, reject) => {
    if (factory === undefined) {
      reject(new Error('This browser has no local storage for the app.'))
      return
    }
    let open: IDBOpenDBRequest
    try {
      open = factory.open(name, 1)
    } catch (e) {
      reject(e instanceof Error ? e : new Error('The browser storage could not be opened.'))
      return
    }
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE)
    }
    open.onerror = () => reject(open.error ?? new Error('The browser storage could not be opened.'))
    open.onblocked = () => reject(new Error('The browser storage is blocked by another open copy of the app.'))
    open.onsuccess = () => {
      const db = open.result
      const store = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE)
      resolve({
        get: (key) => request(store('readonly').get(key)),
        set: (key, value) => request(store('readwrite').put(value, key)).then(() => undefined),
        delete: (key) => request(store('readwrite').delete(key)).then(() => undefined),
      })
    }
  })
}
