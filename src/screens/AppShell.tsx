import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { LanguageSelect } from '../i18n/LanguageSelect'
import { useWorkspace } from '../workspace/useWorkspace'
import { BackupNotice } from './BackupNotice'
import { hashFor, TABS, tabFromHash, type Tab } from './nav'
import { UpdateBanner } from './UpdateBanner'
import './shell.css'

const Plan = lazy(() => import('./plan/PlanScreen'))
const SetupScreen = lazy(() => import('./setup/SetupScreen'))
const ImportScreen = lazy(() => import('./import/ImportScreen'))
const DataScreen = lazy(() => import('./data/DataScreen'))
const RouteScreen = lazy(() => import('./route/RouteScreen'))

function Screen({ tab }: { tab: Tab }) {
  if (tab === 'plan') return <Plan />
  if (tab === 'data') return <DataScreen />
  if (tab === 'import') return <ImportScreen />
  if (tab === 'route') return <RouteScreen />
  return <SetupScreen />
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
      {/* A button, not a link to #main: the address bar's # part is how the screens are chosen. */}
      <button type="button" className="btn btn-primary skip-link" onClick={() => main.current?.focus()}>
        {t('nav.skip')}
      </button>
      <header className="shell-top">
        <span className="brand">{t('app.name')}</span>
        <LanguageSelect />
      </header>
      {status === 'memory' && message !== null && (
        <p className="banner" role="status">
          {message}
        </p>
      )}
      <UpdateBanner />
      <BackupNotice />
      <nav className="shell-nav" aria-label={t('nav.main')}>
        <ul>
          {TABS.map((item) => (
            <li key={item.id}>
              <a href={hashFor(item.id)} aria-current={item.id === tab ? 'page' : undefined}>
                {t(item.labelKey)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <main className="shell-main" ref={main} tabIndex={-1}>
        <Suspense fallback={<p className="screen muted">{t('common.loading')}</p>}>
          <Screen tab={tab} />
        </Suspense>
      </main>
    </div>
  )
}
