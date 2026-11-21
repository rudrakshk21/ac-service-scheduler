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
  it('finds a key or token of a common kind (SEC-3: no secret in the repository)', () => {
    const fake = (parts: string[]): string => parts.join('')
    expect(kinds(fake(['-----BEGIN RSA ', 'PRIVATE KEY-----']))).toEqual(['secret'])
    expect(kinds(fake(['token = "ghp_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"']))).toEqual(['secret'])
    expect(kinds(fake(['key: AKIA', 'ABCDEFGHIJKLMNOP']))).toEqual(['secret'])
    expect(kinds(fake(['x = "xoxb-', '1234567890-abcdefghij"']))).toEqual(['secret'])
    expect(kinds(fake(['Authorization: Bearer eyJ', 'hbGciOiJIUzI1NiIsInR5cCI6IkpX.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV']))).toEqual(['secret'])
  })
  it('does not mistake ordinary text for a secret', () => {
    expect(kinds('the sk-1 rule, ghp is a prefix, AKIA alone, a long-identifier-with-dashes-that-is-just-a-name-1234567890')).toEqual([])
  })
  it('reads Windows line ends and finds several things in one text', () => {
    expect(kinds('a@b.co\r\nC:\\Users\\x\\y')).toEqual(['email address', 'local path'])
  })
})
