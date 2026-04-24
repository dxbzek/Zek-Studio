import { useEffect, useState } from 'react'

// BeforeInstallPromptEvent isn't in lib.dom yet — typed minimally.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'zek-pwa-install-dismissed-until'
const DISMISS_DAYS = 7

function dismissedRecently() {
  if (typeof window === 'undefined') return false
  const raw = localStorage.getItem(DISMISS_KEY)
  if (!raw) return false
  const until = Number(raw)
  if (!Number.isFinite(until)) return false
  return Date.now() < until
}

// Captures the browser's deferred install prompt and exposes an `install`
// action + a `dismiss` action that silences the banner for a week. The
// `canInstall` flag stays false once the app is installed or the user
// recently dismissed the prompt.
export function usePwaInstall() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState<boolean>(() => dismissedRecently())

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      // App got installed (via our UI or the browser's omnibox) — hide the
      // banner permanently for this session by clearing the captured event.
      setEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!event) return
    await event.prompt()
    // After prompt, the event is consumed; clear it regardless of outcome.
    setEvent(null)
  }

  const dismiss = () => {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(DISMISS_KEY, String(until))
    setDismissed(true)
  }

  return {
    canInstall: !!event && !dismissed,
    install,
    dismiss,
  }
}
