export interface LocaleInfo {
  /** Short code: `en`, `hi`. */
  code: string
  /** The language's name in that language, for the chooser. */
  name: string
  dir: 'ltr' | 'rtl'
  /** Made from the English messages for testing; not offered to people. */
  test?: boolean
  /** Written by the assistant and not yet read by a native speaker. */
  draft?: boolean
}

/** Every language the app knows. To add one: put its messages file next to `en.json`, add a line here and in `messagesFor`. */
export const LOCALES: readonly LocaleInfo[] = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'hi', name: 'हिन्दी', dir: 'ltr', draft: true },
  { code: 'xa', name: 'Test: long and accented', dir: 'ltr', test: true },
  { code: 'xb', name: 'Test: right to left', dir: 'rtl', test: true },
]

export const selectable = (): readonly LocaleInfo[] => LOCALES.filter((l) => l.test !== true)

export function isKnown(code: string | null | undefined): code is string {
  return code !== null && code !== undefined && LOCALES.some((l) => l.code === code)
}

/**
 * The language to start in: the one named in the address (`?lang=hi`), else the saved choice, else the first browser
 * language the app has, else English. A test language is used only when asked for by the address or a saved choice.
 */
export function pickLocale(options: { url?: string | null; stored?: string | null; browser?: readonly string[] }): string {
  if (isKnown(options.url)) return options.url
  if (isKnown(options.stored)) return options.stored
  for (const wanted of options.browser ?? []) {
    const base = wanted.toLowerCase().split('-')[0]
    const found = selectable().find((l) => l.code === base)
    if (found !== undefined) return found.code
  }
  return 'en'
}

/**
 * The locale handed to `Intl` for numbers, dates and plurals. English is written day first (`en-GB`), as the app always
 * has; the test languages use English formats.
 */
export function intlLocale(code: string): string {
  if (code === 'en' || LOCALES.find((l) => l.code === code)?.test === true) return 'en-GB'
  return code
}
