import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/bricolage-grotesque/index.css'
import './index.css'
import App from './App.tsx'
import { initLocale } from './i18n'
import { startPwa } from './pwa/register'

// The language is chosen (and its messages loaded) before the first screen, so no screen starts in the wrong language.
void initLocale().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

startPwa()
