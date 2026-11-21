import { translate, translatePlural, type Messages, type Params } from './core'
import en from './en.json'
import { intlLocale, isKnown, LOCALES, pickLocale } from './locales'
import { pseudoMessages } from './pseudo'

/** Every key of the English messages. A key that does not exist is a compile error. */
export type MessageKey = keyof typeof en
type PluralBase<K> = K extends `${infer Base}.other` ? Base : never
/** The keys that have plural forms: written without their `.one` / `.other` ending. */
export type PluralKey = PluralBase<MessageKey>

const english: Messages = en
let state: { code: string; messages: Messages } = { code: 'en', messages: english }
const listeners = new Set<() => void>()
const STORAGE_KEY = 'locale'

/** The text for a key in the current language; English where that language has no text yet. */
export function t(key: MessageKey, params?: Params): string {
  return translate([state.messages, english], key, params)
}

/** The text for a key in the plural form of `count` (`{count}` is filled in the way the language writes numbers). */
export function tn(key: PluralKey, count: number, params?: Params): string {
  return translatePlural([state.messages, english], key, count, intlLocale(state.code), params)
}

/** Like `t`, for a key that may not exist (the label of a field nobody wrote one for): undefined when no language has it. */
export function tOptional(key: string, params?: Params): string | undefined {
  return state.messages[key] !== undefined || english[key] !== undefined ? translate([state.messages, english], key, params) : undefined
}

export const localeCode = (): string => state.code

/** The language in use with all its messages, to hand to code that runs without the page (a worker). */
export const currentLanguage = (): { code: string; messages: Messages } => ({ code: state.code, messages: state.messages })

/**
 * Adopts a language whose messages are already in hand. For a worker: it has no page to set up (no `lang`, no stored
 * choice) and needs no file loaded, because the page sends the messages with the work.
 */
export function adoptLanguage(language: { code: string; messages: Messages }): void {
  state = { code: language.code, messages: language.messages }
}
export const isRtl = (): boolean => LOCALES.find((l) => l.code === state.code)?.dir === 'rtl'

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** "a, b or c": a list of choices written the way the current language writes it. */
export function formatChoices(items: readonly string[]): string {
  return new Intl.ListFormat(intlLocale(state.code), { style: 'long', type: 'disjunction' }).format(items)
}

/** A number written the way the current language writes it. */
export function formatNumber(n: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(state.code), options).format(n)
}

/** A date or time written the way the current language writes it. `timeZone` is passed on. */
export function formatDate(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(state.code), options).format(date)
}

/** The message files next to this one, found by name: a new language needs no line of code. Loaded only when chosen. */
const files = import.meta.glob<{ default: Messages }>('./*.json')

/** The messages of a language. Only English is in the first download; the others load when chosen. */
async function messagesFor(code: string): Promise<Messages> {
  if (code === 'xa') return pseudoMessages(english, 'accent')
  if (code === 'xb') return pseudoMessages(english, 'rtl')
  const load = code === 'en' ? undefined : files[`./${code}.json`]
  return load === undefined ? english : (await load()).default
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** Switches the language: loads it, tells the page its language and direction, and (when `remember`) keeps the choice. */
export async function setLocale(code: string, remember = true): Promise<void> {
  const target = isKnown(code) ? code : 'en'
  const messages = await messagesFor(target)
  state = { code: target, messages }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = intlLocale(target)
    document.documentElement.dir = isRtl() ? 'rtl' : 'ltr'
  }
  if (remember) {
    try {
      localStorage.setItem(STORAGE_KEY, target)
    } catch {
      // A browser that keeps nothing still switches for this visit.
    }
    // The choice is kept now, so the address no longer needs to say it (it would win over a later choice on reload).
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('lang')) {
      const url = new URL(location.href)
      url.searchParams.delete('lang')
      history.replaceState(history.state, '', url)
    }
  }
  listeners.forEach((l) => l())
}

/** Chooses the language at start: the address (`?lang=hi`), a saved choice, the browser's language, or English. */
export async function initLocale(): Promise<void> {
  const url = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('lang')
  const browser = typeof navigator === 'undefined' ? [] : navigator.languages
  await setLocale(pickLocale({ url, stored: readStored(), browser }), isKnown(url))
}
