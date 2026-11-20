import { describe, expect, it } from 'vitest'
import { CASE_FIELDS, FIELDS, normaliseName, openName, PLACE_FIELDS, TECHNICIAN_FIELDS } from './model'
import { fingerprintOf } from './profile'

describe('normaliseName', () => {
  it('lower-cases, strips accents and turns punctuation into single spaces', () => {
    expect(normaliseName('  Ticket_No.  ')).toBe('ticket no')
    expect(normaliseName('Désignation')).toBe('designation')
    expect(normaliseName('Priorität')).toBe('prioritat')
    expect(normaliseName('TICKET-NO')).toBe('ticket no')
    expect(normaliseName('Created  On')).toBe('created on')
  })
  it('keeps letters from other scripts', () => {
    expect(normaliseName('क्षेत्र')).toBe('क्षेत्र')
    expect(normaliseName('地区 / 区域')).toBe('地区 区域')
  })
})

describe('openName', () => {
  it('writes camelCase as snake_case', () => {
    expect(openName('postalCode')).toBe('postal_code')
    expect(openName('caseId')).toBe('case_id')
    expect(openName('area')).toBe('area')
  })
  it('gives every field of the model a lower-case snake_case open name', () => {
    for (const f of [...CASE_FIELDS, ...TECHNICIAN_FIELDS, ...PLACE_FIELDS]) expect(openName(f)).toMatch(/^[a-z]+(_[a-z]+)*$/)
    expect(Object.keys(FIELDS)).toEqual(['cases', 'technicians', 'places'])
  })
})

describe('fingerprintOf', () => {
  it('is stable, ignores case, accents and spacing, and changes with the layout', () => {
    expect(fingerprintOf(['Ticket No', 'Ort'])).toBe(fingerprintOf([' ticket-no ', 'ORT']))
    expect(fingerprintOf(['Ticket No', 'Ort'])).toMatch(/^[0-9a-f]{8}$/)
    expect(fingerprintOf(['Ticket No', 'Ort'])).not.toBe(fingerprintOf(['Ort', 'Ticket No']))
    expect(fingerprintOf(['Ticket No', 'Ort'])).not.toBe(fingerprintOf(['Ticket No', 'Ort', 'Status']))
  })
})
