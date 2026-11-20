import { describe, expect, it } from 'vitest'
import { IntakeError } from '../errors'
import { jsonToRows } from './json'

describe('jsonToRows', () => {
  it('reads a list of objects, with columns in first-seen order and null for gaps', () => {
    const rows = jsonToRows('[{"id":"1","area":"A"},{"id":"2","note":"x"}]', 'f.json')
    expect(rows).toEqual([['id', 'area', 'note'], ['1', 'A', null], ['2', null, 'x']])
  })
  it('reads the first list of objects inside an object', () => {
    const rows = jsonToRows('{"exportedAt":"2026-01-01","tickets":[{"id":1}]}', 'f.json')
    expect(rows).toEqual([['id'], [1]])
  })
  it('flattens one level of nesting with dots and joins plain lists with semicolons', () => {
    const rows = jsonToRows('[{"id":"1","location":{"lat":8.5,"lon":76.9},"skills":["a","b"],"deep":{"x":{"y":1}}}]', 'f.json')
    expect(rows[0]).toEqual(['id', 'location.lat', 'location.lon', 'skills', 'deep.x'])
    expect(rows[1]).toEqual(['1', 8.5, 76.9, 'a;b', '{"y":1}'])
  })
  it('keeps booleans and turns lists of objects into text', () => {
    const rows = jsonToRows('[{"ok":true,"items":[{"a":1}]}]', 'f.json')
    expect(rows[1]).toEqual([true, '[{"a":1}]'])
  })
  it('names the file when it cannot be used', () => {
    expect(() => jsonToRows('{oops', 'bad.json')).toThrow('bad.json is not valid JSON')
    expect(() => jsonToRows('{"a":1}', 'x.json')).toThrow('no list of records')
    expect(() => jsonToRows('[1,2,3]', 'x.json')).toThrow('no list of records')
    expect(() => jsonToRows('[]', 'x.json')).toThrow(IntakeError)
    try {
      jsonToRows('[]', 'x.json')
    } catch (e) {
      expect((e as IntakeError).code).toBe('empty_file')
    }
    try {
      jsonToRows('{"a":1}', 'x.json')
    } catch (e) {
      expect((e as IntakeError).code).toBe('not_a_data_file')
    }
  })
})
