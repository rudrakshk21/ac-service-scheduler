import { describe, expect, it } from 'vitest'
import type { Visit } from '../../share/report'
import { memoryStore } from '../../workspace/db'
import { clearDrafts, draftVisits, forgetVisit, loadDrafts, markSent, MAX_DRAFTS, reportVisit, saveDrafts, sentAt, type Draft } from './reportStore'

const T = 'Asha K.'
const D = '2026-11-23'
const v = (caseId: string, over: Partial<Visit> = {}): Visit => ({ caseId, status: 'done', ...over })

describe('reportVisit and draftVisits', () => {
  it('start a route\'s report with the first visit entered', () => {
    const list = reportVisit([], T, D, v('A1', { finishedAt: '10:00' }))
    expect(draftVisits(list, T, D)).toEqual([{ caseId: 'A1', status: 'done', finishedAt: '10:00' }])
  })
  it('replace the entry of a visit that is entered again, and keep the others', () => {
    let list = reportVisit([], T, D, v('A1'))
    list = reportVisit(list, T, D, v('A2', { status: 'not_done', reason: 'no_access' }))
    list = reportVisit(list, T, D, v('A1', { status: 'partly', reason: 'part_missing', remarks: 'back tomorrow' }))
    expect(draftVisits(list, T, D)).toEqual([
      { caseId: 'A1', status: 'partly', reason: 'part_missing', remarks: 'back tomorrow' },
      { caseId: 'A2', status: 'not_done', reason: 'no_access' },
    ])
  })
  it('keep each technician and each day apart', () => {
    let list = reportVisit([], T, D, v('A1'))
    list = reportVisit(list, T, '2026-11-24', v('B1'))
    list = reportVisit(list, 'Bo', D, v('C1'))
    expect(draftVisits(list, T, D).map((x) => x.caseId)).toEqual(['A1'])
    expect(draftVisits(list, T, '2026-11-24').map((x) => x.caseId)).toEqual(['B1'])
    expect(draftVisits(list, 'Bo', D).map((x) => x.caseId)).toEqual(['C1'])
  })
  it('do not change the list they were given', () => {
    const list = reportVisit([], T, D, v('A1'))
    const copy = structuredClone(list)
    reportVisit(list, T, D, v('A2'))
    expect(list).toEqual(copy)
  })
  it('drop a reason from a visit that was done and empty fields from every visit', () => {
    const list = reportVisit([], T, D, v('A1', { reason: 'other', finishedAt: '', remarks: ' ' }))
    expect(draftVisits(list, T, D)).toEqual([{ caseId: 'A1', status: 'done' }])
  })
})

describe('forgetVisit', () => {
  it('takes one visit out, and the route\'s draft with it when it was the last', () => {
    let list = reportVisit(reportVisit([], T, D, v('A1')), T, D, v('A2'))
    list = forgetVisit(list, T, D, 'A1')
    expect(draftVisits(list, T, D).map((x) => x.caseId)).toEqual(['A2'])
    list = forgetVisit(list, T, D, 'A2')
    expect(list).toEqual([])
  })
  it('is fine for a visit that was never entered', () => {
    expect(forgetVisit([], T, D, 'A1')).toEqual([])
  })
})

describe('markSent and sentAt', () => {
  it('remember when the report was last sent, and forget it when a visit changes after that', () => {
    let list = reportVisit([], T, D, v('A1'))
    expect(sentAt(list, T, D)).toBeUndefined()
    list = markSent(list, T, D, '2026-11-23T14:00:00.000Z')
    expect(sentAt(list, T, D)).toBe('2026-11-23T14:00:00.000Z')
    list = reportVisit(list, T, D, v('A2'))
    expect(sentAt(list, T, D)).toBeUndefined()
  })
})

describe('the saved drafts', () => {
  it('keep at most the newest routes', () => {
    let list: Draft[] = []
    for (let i = 0; i < MAX_DRAFTS + 5; i++) list = reportVisit(list, `Tech ${i}`, D, v('A1'))
    expect(list).toHaveLength(MAX_DRAFTS)
    expect(draftVisits(list, `Tech ${MAX_DRAFTS + 4}`, D)).toHaveLength(1)
    expect(draftVisits(list, 'Tech 0', D)).toEqual([])
  })
  it('are saved, read back, and cleared', async () => {
    const store = memoryStore()
    const list = markSent(reportVisit([], T, D, v('A1', { remarks: 'ok' })), T, D, '2026-11-23T14:00:00.000Z')
    await saveDrafts(store, list)
    expect(await loadDrafts(store)).toEqual(list)
    await clearDrafts(store)
    expect(await loadDrafts(store)).toEqual([])
    expect(await store.get('reports')).toBeUndefined()
  })
  it('read as no drafts when what is stored is not a list', async () => {
    const store = memoryStore()
    await store.set('reports', { oops: true })
    expect(await loadDrafts(store)).toEqual([])
  })
  it('drop a damaged entry or visit instead of failing, and keep only the fields of a draft', async () => {
    const store = memoryStore()
    await store.set('reports', [
      { technician: T, date: D, visits: [v('A1'), { caseId: '', status: 'done' }, { caseId: 'A2', status: 'bogus' }, 'x', v('A1')], secret: 'no' },
      { technician: '', date: D, visits: [v('B1')] },
      { technician: 'Bo', date: 'yesterday', visits: [v('C1')] },
      null,
      'not a draft',
    ])
    const back = await loadDrafts(store)
    expect(back).toEqual([{ technician: T, date: D, visits: [{ caseId: 'A1', status: 'done' }] }])
  })
})
