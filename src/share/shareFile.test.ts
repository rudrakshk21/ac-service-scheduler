import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const downloads: string[] = []
vi.mock('../screens/files', () => ({ downloadBlob: (name: string) => { downloads.push(name) } }))

import { shareOrDownload } from './shareFile'

interface Fake {
  canShare?: (data: { files: File[] }) => boolean
  share?: (data: { files: File[]; title: string }) => Promise<void>
}
const useNavigator = (fake: Fake): void => { vi.stubGlobal('navigator', fake) }

beforeEach(() => { downloads.length = 0 })
afterEach(() => { vi.unstubAllGlobals() })

describe('shareOrDownload', () => {
  it('shares the file when the share sheet takes its type', async () => {
    const shared: string[] = []
    useNavigator({ canShare: () => true, share: (d) => { shared.push(d.files[0].name); return Promise.resolve() } })
    expect(await shareOrDownload('route.json', '{}', 'application/json', { fileName: 'route.txt', type: 'text/plain' })).toBe('shared')
    expect(shared).toEqual(['route.json'])
    expect(downloads).toEqual([])
  })

  it('tries the other form of the file when the share sheet refuses the first (Chrome on Android refuses .json)', async () => {
    const shared: string[] = []
    useNavigator({
      canShare: (d) => d.files[0].name.endsWith('.txt'),
      share: (d) => { shared.push(`${d.files[0].name} ${d.files[0].type}`); return Promise.resolve() },
    })
    expect(await shareOrDownload('route.json', '{"a":1}', 'application/json', { fileName: 'route.txt', type: 'text/plain' })).toBe('shared')
    expect(shared).toEqual(['route.txt text/plain'])
    expect(downloads).toEqual([])
  })

  it('shares the same content under the other name', async () => {
    let text = ''
    useNavigator({ canShare: (d) => d.files[0].name.endsWith('.txt'), share: async (d) => { text = await d.files[0].text() } })
    await shareOrDownload('route.json', '{"visit":1}', 'application/json', { fileName: 'route.txt', type: 'text/plain' })
    expect(text).toBe('{"visit":1}')
  })

  it('saves the file under its own name when the share sheet takes neither form', async () => {
    useNavigator({ canShare: () => false, share: () => Promise.reject(new Error('never called')) })
    expect(await shareOrDownload('route.json', '{}', 'application/json', { fileName: 'route.txt', type: 'text/plain' })).toBe('downloaded')
    expect(downloads).toEqual(['route.json'])
  })

  it('saves the file when the browser has no share sheet at all', async () => {
    useNavigator({})
    expect(await shareOrDownload('plan.xlsx', 'x', 'application/octet-stream')).toBe('downloaded')
    expect(downloads).toEqual(['plan.xlsx'])
  })

  it('does not download when the person closes the share sheet', async () => {
    useNavigator({ canShare: () => true, share: () => Promise.reject(new DOMException('closed', 'AbortError')) })
    expect(await shareOrDownload('route.json', '{}', 'application/json', { fileName: 'route.txt', type: 'text/plain' })).toBe('cancelled')
    expect(downloads).toEqual([])
  })

  it('goes on to the other form, then to a download, when sharing fails for another reason', async () => {
    const tried: string[] = []
    useNavigator({ canShare: () => true, share: (d) => { tried.push(d.files[0].name); return Promise.reject(new DOMException('no', 'NotAllowedError')) } })
    expect(await shareOrDownload('route.json', '{}', 'application/json', { fileName: 'route.txt', type: 'text/plain' })).toBe('downloaded')
    expect(tried).toEqual(['route.json', 'route.txt'])
    expect(downloads).toEqual(['route.json'])
  })
})
