import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useWorkspace } from '../workspace/useWorkspace'
import { hashFor, TABS, tabFromHash, type Tab } from './nav'
import './shell.css'

const Plan = lazy(() => import('../demo/DemoPage').then((m) => ({ default: m.DemoPage })))
const Placeholder = lazy(() => import('./Placeholder'))
const ImportScreen = lazy(() => import('./import/ImportScreen'))
const DataScreen = lazy(() => import('./data/DataScreen'))

function Screen({ tab }: { tab: Tab }) {
  if (tab === 'plan') return <Plan />
  if (tab === 'data') return <DataScreen />
  if (tab === 'import') return <ImportScreen />
  return <Placeholder title="Set-up" text="Work types, skills, places and rules for your centre will be set here." />
}

export function AppShell() {
  const { status, message } = useWorkspace()
  const [tab, setTab] = useState<Tab>(() => tabFromHash(window.location.hash))
  const main = useRef<HTMLElement>(null)
  const first = useRef(true)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // After a tab change, move focus to the new screen so keyboard and screen-reader users start at its top.
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    main.current?.focus()
  }, [tab])

  return (
    <div className="shell">
      <header className="shell-top">
        <span className="brand">AC Service Scheduler</span>
      </header>
      {status === 'memory' && message !== null && (
        <p className="banner" role="status">
          {message}
        </p>
      )}
      <nav className="shell-nav" aria-label="Main">
        <ul>
          {TABS.map((t) => (
            <li key={t.id}>
              <a href={hashFor(t.id)} aria-current={t.id === tab ? 'page' : undefined}>
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <main className="shell-main" ref={main} tabIndex={-1}>
        <Suspense fallback={<p className="screen muted">Loading…</p>}>
          <Screen tab={tab} />
        </Suspense>
      </main>
    </div>
  )
}
