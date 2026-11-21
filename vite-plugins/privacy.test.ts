import { describe, expect, it } from 'vitest'
import { privacyFindings } from './privacy.ts'

const kinds = (text: string): string[] => privacyFindings(text).map((f) => f.kind)

describe('privacyFindings', () => {
  it('finds paths on a computer, Windows and Unix style', () => {
    expect(kinds('cd C:\\Users\\someone\\Projects\\app')).toEqual(['local path'])
    expect(kinds('cp "C:/Users/someone/Desktop/x.py" .')).toEqual(['local path'])
    expect(kinds('see /Users/someone/work/app and more')).toEqual(['local path'])
    expect(kinds("path = '/home/someone/app/'")).toEqual(['local path'])
  })
  it('does not mistake a project path or a URL for one', () => {
    expect(kinds('import x from "../users/list"')).toEqual([])
    expect(kinds('https://example.com/Users/list/')).toEqual([])
    expect(kinds('src/screens/users/')).toEqual([])
  })
  it('finds a cloud-drive folder', () => {
    expect(kinds('C:/x/OneDrive - Some Institute/Desktop')).toContain('cloud folder')
    expect(kinds('Dropbox/Projects/app')).toEqual(['cloud folder'])
  })
  it('finds a person\'s email address with its line', () => {
    expect(privacyFindings('one\ntwo a.b@gmail.com three')).toEqual([{ line: 2, kind: 'email address', text: 'a.b@gmail.com' }])
  })
  it('lets the attribution line, GitHub no-reply addresses and made-up domains through', () => {
    const text = 'Co-Authored-By: Someone <noreply@anthropic.com>\n123+name@users.noreply.github.com\nuser@example.com\nme@mail.example.org\nx@host.test'
    expect(privacyFindings(text)).toEqual([])
  })
  it('reads Windows line ends and finds several things in one text', () => {
    expect(kinds('a@b.co\r\nC:\\Users\\x\\y')).toEqual(['email address', 'local path'])
  })
})
