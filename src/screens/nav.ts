import type { MessageKey } from '../i18n'

export type Tab = 'plan' | 'data' | 'import' | 'setup' | 'route'

export const TABS: { id: Tab; labelKey: MessageKey }[] = [
  { id: 'plan', labelKey: 'nav.plan' },
  { id: 'data', labelKey: 'nav.data' },
  { id: 'import', labelKey: 'nav.import' },
  { id: 'setup', labelKey: 'nav.setup' },
  { id: 'route', labelKey: 'nav.route' },
]

/** The tab named by the URL hash (`#/data`). Anything else gives the plan. */
export function tabFromHash(hash: string): Tab {
  if (!hash.startsWith('#')) return 'plan'
  const name = hash.replace(/^#\/?/, '')
  return TABS.find((t) => t.id === name)?.id ?? 'plan'
}

export function hashFor(tab: Tab): string {
  return `#/${tab}`
}
