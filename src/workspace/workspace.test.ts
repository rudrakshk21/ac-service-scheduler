import { describe, expect, it } from 'vitest'
import { starterSite } from '../intake/site/starter'
import { memoryStore } from './db'
import { emptyWorkspace, loadWorkspace, saveWorkspace, WorkspaceError } from './workspace'

describe('workspace', () => {
  it('starts empty with the starter site', () => {
    const w = emptyWorkspace()
    expect(w.site).toEqual(starterSite())
    expect([w.technicians, w.cases, w.profiles, w.changes, w.imports]).toEqual([[], [], [], [], []])
    expect(emptyWorkspace()).not.toBe(w)
  })
  it('saves and loads', async () => {
    const store = memoryStore()
    const w = emptyWorkspace()
    w.site.name = 'My centre'
    await saveWorkspace(store, w)
    expect(await loadWorkspace(store)).toEqual(w)
  })
  it('gives null when nothing is saved', async () => {
    expect(await loadWorkspace(memoryStore())).toBeNull()
  })
  it('fills in lists that an older save did not have', async () => {
    const store = memoryStore()
    await store.set('workspace', { workspaceVersion: 1, site: starterSite() })
    const w = await loadWorkspace(store)
    expect(w?.cases).toEqual([])
    expect(w?.imports).toEqual([])
  })
  it('does not open data from a newer version, and leaves it alone', async () => {
    const store = memoryStore()
    await store.set('workspace', { workspaceVersion: 2, site: 'future' })
    const err = await loadWorkspace(store).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(WorkspaceError)
    expect((err as Error).message).toContain('newer version')
    expect(await store.get('workspace')).toEqual({ workspaceVersion: 2, site: 'future' })
  })
  it('does not open damaged data', async () => {
    for (const bad of ['text', 5, [], { site: 1 }, { workspaceVersion: 'x' }]) {
      const store = memoryStore()
      await store.set('workspace', bad)
      const err = await loadWorkspace(store).catch((e: unknown) => e)
      expect((err as Error).message).toContain('damaged')
    }
  })
})
