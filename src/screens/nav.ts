export type Tab = 'plan' | 'data' | 'import' | 'setup' | 'route'

export const TABS: { id: Tab; label: string }[] = [
  { id: 'plan', label: 'Plan' },
  { id: 'data', label: 'Data' },
  { id: 'import', label: 'Import' },
  { id: 'setup', label: 'Set-up' },
  { id: 'route', label: 'Route' },
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
