import { afterEach, describe, expect, it } from 'vitest'
import en from '../i18n/en.json'
import hi from '../i18n/hi.json'
import { adoptLanguage, currentLanguage, t } from '../i18n'
import { applyProfile } from '../intake/map/apply'
import { suggestProfile } from '../intake/map/suggest'
import { readSource } from '../intake/read'
import { starterSite } from '../intake/site/starter'
import { handleIntakeRequest, type IntakeRequest } from './intakeHandler'

const english = { code: 'en', messages: en as Record<string, string> }
const hindi = { code: 'hi', messages: hi as Record<string, string> }
const bytes = (s: string): Uint8Array => new TextEncoder().encode(s)
const CASES = 'Id,Work type,Latitude,Longitude\nA-1,Service,20.1,30.05\nA-2,Installation,19.95,30.1\n,Service,20.2,30.2\n'

afterEach(() => adoptLanguage(english))

describe('adoptLanguage', () => {
  it('switches the messages without a page, and reports what is in use', () => {
    adoptLanguage({ code: 'hi', messages: { 'intake.ex.noCaseId': 'नमूना' } })
    expect(currentLanguage().code).toBe('hi')
    expect(t('intake.ex.noCaseId')).toBe('नमूना')
    expect(t('intake.ex.noTechName')).toBe(en['intake.ex.noTechName']) // a message the language lacks falls back to English
  })
})

describe('handleIntakeRequest: read', () => {
  it('returns the same table as reading the file directly', async () => {
    const reply = await handleIntakeRequest({ op: 'read', language: english, data: bytes(CASES), name: 'cases.csv', options: {} })
    expect(reply.ok).toBe(true)
    expect(reply.ok && reply.op === 'read' ? reply.table : null).toEqual(await readSource(bytes(CASES), 'cases.csv'))
  })

  it('returns a refusal as plain data, with its name, code and message', async () => {
    const reply = await handleIntakeRequest({ op: 'read', language: english, data: bytes(''), name: 'empty.csv', options: {} })
    expect(reply).toEqual({ ok: false, error: { name: 'IntakeError', code: 'empty_file', message: 'empty.csv is empty.' } })
  })

  it('writes the refusal in the language of the request', async () => {
    const reply = await handleIntakeRequest({ op: 'read', language: hindi, data: bytes(''), name: 'khali.csv', options: {} })
    expect(reply.ok).toBe(false)
    expect(!reply.ok && reply.error.message).toBe(hi['intake.file.empty'].replace('{file}', 'khali.csv'))
  })
})

describe('handleIntakeRequest: apply', () => {
  const site = starterSite()
  const request = async (language: IntakeRequest['language']): Promise<IntakeRequest> => {
    const table = await readSource(bytes(CASES), 'cases.csv')
    const { profile } = suggestProfile(table, 'cases', site, 'cases.csv')
    return { op: 'apply', language, table, profile, site, importDate: '2026-11-22' }
  }

  it('returns what applying the profile directly gives', async () => {
    const req = await request(english)
    if (req.op !== 'apply') throw new Error('wrong request')
    const reply = await handleIntakeRequest(req)
    expect(reply.ok && reply.op === 'apply' ? reply.imported : null).toEqual(applyProfile(req.table, req.profile, req.site, req.importDate))
  })

  it('writes the problems it finds in the language of the request', async () => {
    const reply = await handleIntakeRequest(await request(hindi))
    const details = reply.ok && reply.op === 'apply' ? reply.imported.exceptions.map((e) => e.detail) : []
    expect(details).toContain(hi['intake.ex.noCaseId'])
    expect(details).not.toContain(en['intake.ex.noCaseId'])
  })

  it('does not throw: a problem inside comes back as a reply', async () => {
    const req = await request(english)
    if (req.op !== 'apply') throw new Error('wrong request')
    const reply = await handleIntakeRequest({ ...req, table: null as never })
    expect(reply.ok).toBe(false)
    expect(!reply.ok && reply.error.message).toEqual(expect.any(String))
  })
})
