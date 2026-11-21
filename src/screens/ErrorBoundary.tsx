import { Component, useContext, type ErrorInfo, type ReactNode } from 'react'
import { t } from '../i18n'
import { WorkspaceContext } from '../workspace/useWorkspace'
import { saveBackupFile } from './files'

/** What a person sees when a screen crashes: what happened, what is safe, and what to do. */
function CrashScreen({ error }: { error: Error }) {
  // The workspace may not exist (when the crash is above it), so it is read without the hook that insists on it.
  const workspace = useContext(WorkspaceContext)
  return (
    <section className="screen stack" role="alert" style={{ marginTop: 24 }}>
      <h1 className="screen-title">{t('crash.title')}</h1>
      <p>{t('crash.text')}</p>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>{t('crash.reload')}</button>
        {workspace !== null && workspace.workspace.cases.length + workspace.workspace.technicians.length > 0 && (
          <button type="button" className="btn" onClick={() => saveBackupFile(workspace.workspace, workspace.update)}>{t('crash.backup')}</button>
        )}
      </div>
      <details className="setup-details">
        <summary>{t('crash.details')}</summary>
        <pre className="small" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{`${error.name}: ${error.message}`}</pre>
      </details>
    </section>
  )
}

interface State {
  error: Error | null
}

/** Catches a crash while a screen is drawn, so the page is never left blank. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The only trace there is: nothing is sent anywhere.
    console.error(error, info.componentStack)
  }

  render(): ReactNode {
    return this.state.error === null ? this.props.children : <CrashScreen error={this.state.error} />
  }
}
