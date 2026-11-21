import { useLocale } from './i18n/useLocale'
import { AppShell } from './screens/AppShell'
import { WorkspaceProvider } from './workspace/WorkspaceProvider'

export default function App() {
  // Changing the language starts the screens again, so every word is written again in the new language.
  const locale = useLocale()
  return (
    <WorkspaceProvider>
      <AppShell key={locale} />
    </WorkspaceProvider>
  )
}
