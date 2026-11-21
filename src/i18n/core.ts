/** Values that fill the `{name}` placeholders of a message. */
export type Params = Readonly<Record<string, string | number>>

/** The messages of one language: a key and its text. */
export type Messages = Readonly<Record<string, string>>

/** Fills `{name}` placeholders. A placeholder with no value is left as written, so a gap shows instead of vanishing. */
export function format(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole))
}

/** The placeholder names in a message, once each, sorted. Used to check that every language fills the same ones. */
export function placeholders(template: string): string[] {
  return [...new Set([...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort()
}

/** The message for a key from the first set that has it, filled in. The key itself when no set has it, so a gap shows. */
export function translate(chain: readonly Messages[], key: string, params?: Params): string {
  for (const set of chain) {
    const text = set[key]
    if (text !== undefined) return format(text, params)
  }
  return key
}

/**
 * The message for a key in the plural form of `count`. Forms are keys with a suffix: `key.one`, `key.other`, and for
 * languages that have them `key.zero`, `key.two`, `key.few`, `key.many`. The form comes from `Intl.PluralRules`; when a
 * language has no key for it, `key.other` is used. `{count}` is filled with the count written the way the language writes it.
 */
export function translatePlural(chain: readonly Messages[], key: string, count: number, locale: string, params?: Params): string {
  const category = new Intl.PluralRules(locale).select(count)
  const values: Params = { count: new Intl.NumberFormat(locale).format(count), ...params }
  for (const set of chain) {
    for (const form of [category, 'other']) {
      const text = set[`${key}.${form}`]
      if (text !== undefined) return format(text, values)
    }
  }
  return key
}
