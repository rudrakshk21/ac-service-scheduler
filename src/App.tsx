import { useLocale } from './i18n/useLocale'
import { AppShell } from './screens/AppShell'
import { ErrorBoundary } from './screens/ErrorBoundary'
import { WorkspaceProvider } from './workspace/WorkspaceProvider'

export default function App() {
  // Changing the language starts the screens again, so every word is written again in the new language.
  const locale = useLocale()
  // Two boundaries: the inner one keeps the workspace alive so the crash screen can offer a backup; the outer one
  // catches a crash in the workspace itself.
  return (
    <ErrorBoundary>
      <WorkspaceProvider>
        <ErrorBoundary>
          <AppShell key={locale} />
        </ErrorBoundary>
      </WorkspaceProvider>
    </ErrorBoundary>
  )
}
