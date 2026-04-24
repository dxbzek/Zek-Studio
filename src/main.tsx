import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSentry, SentryErrorBoundary } from './lib/sentry'

// Init before render so any boot-time throw is captured.
initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryErrorBoundary
      fallback={({ resetError }) => (
        <div className="min-h-screen flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-3">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              The error has been reported. Try reloading — if it keeps happening, contact support.
            </p>
            <button
              type="button"
              onClick={resetError}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-accent transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    >
      <App />
    </SentryErrorBoundary>
  </StrictMode>,
)
