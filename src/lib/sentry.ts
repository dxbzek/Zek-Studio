// Sentry init + helpers.
//
// Env vars (set on Vercel → Project → Settings → Environment Variables):
//   VITE_SENTRY_DSN       required  – public DSN from Sentry project
//   VITE_SENTRY_RELEASE   optional  – commit sha / version tag (CI-supplied)
//
// Without VITE_SENTRY_DSN we skip init entirely, so local dev stays
// noise-free and Sentry never phones home from a dev build.

import * as Sentry from '@sentry/react'

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined

export function initSentry() {
  if (!DSN) return
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    integrations: [
      Sentry.browserTracingIntegration(),
      // Session replay captures DOM + network on errored sessions so we can
      // actually reproduce what the user did. maskAllInputs hides typed text
      // (passwords, brand content-in-progress); everything else is visible.
      Sentry.replayIntegration({
        maskAllText: false,
        maskAllInputs: true,
        blockAllMedia: false,
      }),
    ],
    // Low default: route nav + a handful of fetch spans per session, enough
    // to see latency trends without quota exhaustion.
    tracesSampleRate: 0.1,
    // Don't record replay for every session — only when an error fires.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    ignoreErrors: [
      // Common browser noise that isn't actionable.
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Extension-injected errors we can't fix.
      "Cannot read properties of null (reading 'sendMessage')",
    ],
  })
}

export function setSentryUser(user: { id: string; email?: string | null } | null) {
  if (!DSN) return
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email ?? undefined })
  } else {
    Sentry.setUser(null)
  }
}

// Re-export the ErrorBoundary so App can wrap routes without pulling in
// the Sentry namespace directly.
export const SentryErrorBoundary = Sentry.ErrorBoundary
