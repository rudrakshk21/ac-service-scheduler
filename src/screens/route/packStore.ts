import { PackError, parsePack, serialisePack, type RoutePack } from '../../share/routePack'
import type { KeyValueStore } from '../../workspace/db'

/** A phone keeps this many route packs; the oldest go first. */
export const MAX_PACKS = 20

const KEY = 'routePacks'

const same = (p: RoutePack, technician: string, date: string): boolean => p.technician === technician && p.date === date

/** The list with `pack` added: a pack for the same technician and date is replaced, the newest is first, at most 20. */
export function addPack(list: RoutePack[], pack: RoutePack): RoutePack[] {
  return [pack, ...list.filter((p) => !same(p, pack.technician, pack.date))]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, MAX_PACKS)
}

export function removePack(list: RoutePack[], technician: string, date: string): RoutePack[] {
  return list.filter((p) => !same(p, technician, date))
}

/** The saved packs. Each one is read again like a file, so a damaged entry is dropped and nothing extra comes through. */
export async function loadPacks(store: KeyValueStore): Promise<RoutePack[]> {
  const raw = await store.get(KEY)
  if (!Array.isArray(raw)) return []
  const packs: RoutePack[] = []
  for (const entry of raw) {
    try {
      packs.push(parsePack(JSON.stringify(entry)))
    } catch (e) {
      if (!(e instanceof PackError)) throw e
    }
  }
  return packs
}

export async function savePacks(store: KeyValueStore, list: RoutePack[]): Promise<void> {
  await store.set(KEY, list.map((p) => JSON.parse(serialisePack(p)) as unknown))
}
