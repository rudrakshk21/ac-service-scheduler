import { AppShell } from './screens/AppShell'
import { WorkspaceProvider } from './workspace/WorkspaceProvider'

export default function App() {
  return (
    <WorkspaceProvider>
      <AppShell />
    </WorkspaceProvider>
  )
}
