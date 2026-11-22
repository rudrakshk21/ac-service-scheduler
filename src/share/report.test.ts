import { describe, expect, it } from 'vitest'
import { buildReport, MAX_REMARKS, MAX_VISITS, parseReport, REASONS, reportFileName, ReportError, serialiseReport, type ReportFile, type Visit } from './report'

const pack = { site: 'Centre', technician: 'Asha K.', date: '2026-11-23', stops: [{ caseId: 'A1' }, { caseId: 'A2' }, { caseId: 'A3' }] }
const NOW = '2026-11-23T14:00:00.000Z'

const file = (over: Partial<ReportFile> = {}): ReportFile => ({
  reportVersion: 1, site: 'Centre', technician: 'Asha K.', date: '2026-11-23', createdAt: NOW,
  visits: [{ caseId: 'A1', status: 'done', finishedAt: '10:15', remarks: 'Gas topped up' }], ...over,
})
const text = (f: unknown): string => JSON.stringify(f)

describe('buildReport', () => {
  it('makes a file for the route, with the visits in the order of the stops', () => {
    const entries: Visit[] = [{ caseId: 'A3', status: 'not_done', reason: 'no_access' }, { caseId: 'A1', status: 'done', finishedAt: '09:40' }]
    const f = buildReport(pack, entries, NOW)
    expect(f).toMatchObject({ reportVersion: 1, site: 'Centre', technician: 'Asha K.', date: '2026-11-23', createdAt: NOW })
    expect(f.visits.map((v) => v.caseId)).toEqual(['A1', 'A3'])
  })
  it('leaves out an entry for a case that is not a stop of the route', () => {
    expect(buildReport(pack, [{ caseId: 'ZZ', status: 'done' }], NOW).visits).toEqual([])
  })
  it('drops a reason from a visit that was done, and empty fields from every visit', () => {
    const f = buildReport(pack, [{ caseId: 'A1', status: 'done', reason: 'other', finishedAt: '', remarks: '   ' }], NOW)
    expect(f.visits).toEqual([{ caseId: 'A1', status: 'done' }])
  })
  it('keeps the reason of a visit that was not done or only partly done', () => {
    const f = buildReport(pack, [{ caseId: 'A1', status: 'partly', reason: 'part_missing' }], NOW)
    expect(f.visits[0]).toMatchObject({ status: 'partly', reason: 'part_missing' })
  })
})

describe('serialiseReport and parseReport', () => {
  it('give back the same file', () => {
    expect(parseReport(serialiseReport(file()))).toEqual(file())
  })
  it('read every status and every reason', () => {
    const visits: Visit[] = REASONS.map((reason, i) => ({ caseId: `C${i}`, status: i % 2 === 0 ? 'not_done' : 'partly', reason }))
    expect(parseReport(text(file({ visits }))).visits).toEqual(visits)
  })
  it('drop everything that is not part of a report, so a customer name cannot ride along', () => {
    const raw = { ...file(), customerName: 'Someone', visits: [{ caseId: 'A1', status: 'done', customerName: 'Someone', phone: '999', address: 'Road 1' }] }
    const back = parseReport(text(raw))
    expect(JSON.stringify(back)).not.toMatch(/Someone|999|Road 1/)
    expect(Object.keys(back).sort()).toEqual(['createdAt', 'date', 'reportVersion', 'site', 'technician', 'visits'])
    expect(Object.keys(back.visits[0]).sort()).toEqual(['caseId', 'status'])
  })
  it('drop a reason that goes with a visit that was done', () => {
    const back = parseReport(text(file({ visits: [{ caseId: 'A1', status: 'done', reason: 'other' }] })))
    expect(back.visits[0]).toEqual({ caseId: 'A1', status: 'done' })
  })
  it('cut remarks at the limit instead of refusing the report', () => {
    const long = 'x'.repeat(MAX_REMARKS + 50)
    expect(parseReport(text(file({ visits: [{ caseId: 'A1', status: 'done', remarks: long }] }))).visits[0].remarks).toHaveLength(MAX_REMARKS)
  })
  it('keep the remarks as typed: other scripts, line breaks and a leading equals sign', () => {
    const remarks = '=SUM(1,1)\nग्राहक नहीं था'
    expect(parseReport(text(file({ visits: [{ caseId: 'A1', status: 'not_done', reason: 'customer_absent', remarks }] }))).visits[0].remarks).toBe(remarks)
  })
})

describe('parseReport refuses, with a plain message', () => {
  const refused = (raw: unknown): ReportError => {
    try {
      parseReport(typeof raw === 'string' ? raw : text(raw))
    } catch (e) {
      return e as ReportError
    }
    throw new Error('it was not refused')
  }
  it('text that is not JSON, and JSON that is not a report (a route pack, for one)', () => {
    expect(refused('not json')).toBeInstanceOf(ReportError)
    expect(refused('[]')).toBeInstanceOf(ReportError)
    expect(refused({ packVersion: 1, technician: 'A', stops: [] })).toBeInstanceOf(ReportError)
  })
  it('another version of the format', () => {
    expect(refused({ ...file(), reportVersion: 2 })).toBeInstanceOf(ReportError)
  })
  it('a missing technician, centre, date or creation time, and a date that is not a date', () => {
    for (const bad of [{ technician: '' }, { site: 5 }, { date: '23/11/2026' }, { createdAt: 'yesterday' }, { date: undefined }]) {
      expect(refused({ ...file(), ...bad })).toBeInstanceOf(ReportError)
    }
  })
  it('no visits at all, and more than the most one file may hold', () => {
    expect(refused(file({ visits: [] }))).toBeInstanceOf(ReportError)
    const many = Array.from({ length: MAX_VISITS + 1 }, (_, i): Visit => ({ caseId: `C${i}`, status: 'done' }))
    expect(refused(file({ visits: many }))).toBeInstanceOf(ReportError)
  })
  it('a file far larger than a report can be', () => {
    expect(refused(' '.repeat(300 * 1024))).toBeInstanceOf(ReportError)
  })
  it('a visit with no case, a bad status, a bad reason, a bad time or remarks that are not text, naming which visit', () => {
    const cases: [Record<string, unknown>, number][] = [
      [{ caseId: '', status: 'done' }, 1], [{ caseId: 'A1', status: 'finished' }, 1],
      [{ caseId: 'A1', status: 'not_done', reason: 'lazy' }, 1], [{ caseId: 'A1', status: 'done', finishedAt: '25:00' }, 1],
      [{ caseId: 'A1', status: 'done', finishedAt: '9:5' }, 1], [{ caseId: 'A1', status: 'done', remarks: 42 }, 1],
    ]
    for (const [visit, n] of cases) {
      const e = refused(file({ visits: [visit as unknown as Visit] }))
      expect(e).toBeInstanceOf(ReportError)
      expect(e.message).toContain(String(n))
    }
    const second = refused(file({ visits: [{ caseId: 'A1', status: 'done' }, { caseId: 'A2', status: 'wrong' as never }] }))
    expect(second.message).toContain('2')
  })
  it('a visit that is not an object, and a case that is reported twice', () => {
    expect(refused(file({ visits: ['A1' as unknown as Visit] }))).toBeInstanceOf(ReportError)
    expect(refused(file({ visits: [{ caseId: 'A1', status: 'done' }, { caseId: 'A1', status: 'not_done' }] }))).toBeInstanceOf(ReportError)
  })
})

describe('reportFileName', () => {
  it('uses letters, digits and dashes, and the date', () => {
    expect(reportFileName({ technician: 'Asha K.', date: '2026-11-23' })).toBe('report-asha-k-2026-11-23.json')
    expect(reportFileName({ technician: '  ', date: '2026-11-23' })).toBe('report-technician-2026-11-23.json')
  })
})
