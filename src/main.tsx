import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app'
import { captureInstallPrompt, installGlobalDiagnostics, registerServiceWorker } from '@/pwa'
import { RootErrorBoundary } from '@/pwa/root-error-boundary'
import '@/styles/globals.css'

installGlobalDiagnostics()
captureInstallPrompt()
registerServiceWorker()

const container = document.querySelector('#root')
if (!container) throw new Error('Root element #root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
