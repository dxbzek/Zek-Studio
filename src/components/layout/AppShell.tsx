import { Suspense, useEffect, useState } from 'react'
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Menu, Download, X as XIcon, Plus, CalendarDays, ListChecks, Megaphone } from 'lucide-react'
import { LoadingState } from '@/components/ui/loading-state'
import { useUiState } from '@/stores/uiState'
import { Sidebar } from './Sidebar'
import { SpecialistShell } from './SpecialistShell'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '@/hooks/useAuth'
import { useIsSpecialist } from '@/hooks/useTeam'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { Button } from '@/components/ui/button'

const SIDEBAR_HIDDEN_KEY = 'zek-sidebar-hidden'

const ROUTE_MAP: Record<string, [string, string]> = {
  '/':                   ['Workspace',     'Dashboard'],
  '/brands':             ['Workspace',     'Brands'],
  '/research':           ['Intelligence',  'Research'],
  '/content':            ['Create',        'Content'],
  '/calendar':           ['Create',        'Calendar'],
  '/campaigns':          ['Collaborate',   'Campaigns'],
  '/tasks':              ['Collaborate',   'Tasks'],
  '/workspace':          ['Collaborate',   'Team'],
  '/analytics':          ['Measure',       'Analytics'],
  '/workspace/tasks':    ['Collaborate',   'Tasks'],
  '/workspace/team':     ['Collaborate',   'Team'],
}

function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { pathname } = useLocation()
  const [section, title] = ROUTE_MAP[pathname] ?? ['', pathname.replace('/', '')]

  return (
    <header
      className="glass-surface sticky top-0 z-30 flex h-[52px] shrink-0 items-center gap-3 border-b border-border/70 px-4"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
        height: 'calc(52px + env(safe-area-inset-top))',
      }}
    >
      {/* Hamburger — mobile drawer toggle + desktop sidebar collapse */}
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0"
        onClick={onMenuClick}
        aria-label="Toggle sidebar"
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {section && (
          <>
            <span
              className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {section}
            </span>
            <span className="text-muted-foreground/40 text-[11px]">/</span>
          </>
        )}
        <span className="text-[13px] font-medium truncate">{title}</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
      </div>
    </header>
  )
}

// Mobile-only floating action button. Routes the most common create
// actions to their respective pages — each page already opens its creation
// drawer/form via existing New-button logic, so we don't duplicate that UI
// here; we just get the user there with one tap.
function MobileQuickAdd() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  // Hide while the calendar is in bulk-edit mode — its action bar shares the
  // bottom-right zone and the user is mid-action, not browsing.
  const calendarSelectMode = useUiState((s) => s.calendarSelectMode)
  if (calendarSelectMode) return null

  return (
    <div
      className="sm:hidden fixed bottom-4 right-4 z-30"
      style={{ bottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))' }}
    >
      {open && (
        <>
          <button
            type="button"
            aria-label="Close quick add"
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black/30 supports-backdrop-filter:backdrop-blur-sm cursor-default motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
          />
          <div className="absolute bottom-16 right-0 flex flex-col gap-2 items-end">
            {[
              { to: '/tasks',     icon: ListChecks,   label: 'New task',     delay: 0 },
              { to: '/calendar',  icon: CalendarDays, label: 'New entry',    delay: 60 },
              { to: '/campaigns', icon: Megaphone,    label: 'New campaign', delay: 120 },
            ].map(({ to, icon: Icon, label, delay }) => (
              <button
                key={to}
                type="button"
                onClick={() => { navigate(to); setOpen(false) }}
                className="premium-card flex items-center gap-2 px-3.5 py-2 rounded-full ring-1 ring-border/80 text-[12.5px] font-medium active:scale-95 transition-transform motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 motion-safe:duration-300"
                style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        aria-label={open ? 'Close quick add' : 'Quick add'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative h-14 w-14 rounded-full bg-gradient-to-b from-primary/95 to-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-all duration-150 shadow-[0_1px_0_0_color-mix(in_oklch,white_22%,transparent)_inset,0_4px_12px_-2px_color-mix(in_oklch,black_30%,transparent),0_8px_24px_-8px_color-mix(in_oklch,var(--primary)_60%,transparent)] hover:shadow-[0_1px_0_0_color-mix(in_oklch,white_28%,transparent)_inset,0_6px_16px_-2px_color-mix(in_oklch,black_35%,transparent),0_12px_30px_-8px_color-mix(in_oklch,var(--primary)_70%,transparent)] hover:brightness-110"
      >
        <span
          className={`absolute inset-0 rounded-full transition-transform duration-300 ease-out ${open ? 'rotate-45' : ''}`}
        />
        {open ? <XIcon className="h-5 w-5 relative" /> : <Plus className="h-5 w-5 relative" />}
      </button>
    </div>
  )
}

function PwaInstallBanner() {
  const { canInstall, install, dismiss } = usePwaInstall()
  if (!canInstall) return null
  return (
    <div className="sm:hidden border-b border-border bg-accent/40 px-4 py-2 flex items-center gap-2 text-xs">
      <Download className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <span className="flex-1">Install Zek Studio for offline access and a faster launch.</span>
      <button
        type="button"
        onClick={install}
        className="text-xs font-medium text-primary hover:underline"
      >
        Install
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="text-muted-foreground hover:text-foreground p-0.5"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </div>
  )
}

export function AppShell() {
  const { user, loading: authLoading } = useAuth()
  const { data: isSpecialist, isLoading: roleLoading } = useIsSpecialist()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopHidden, setDesktopHidden] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(SIDEBAR_HIDDEN_KEY) === '1',
  )

  useEffect(() => {
    localStorage.setItem(SIDEBAR_HIDDEN_KEY, desktopHidden ? '1' : '0')
  }, [desktopHidden])

  function handleMenuClick() {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches) {
      setDesktopHidden((h) => !h)
    } else {
      setSidebarOpen(true)
    }
  }

  if (authLoading || (user && roleLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <LoadingState variant="page" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (isSpecialist) {
    return <SpecialistShell />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 supports-backdrop-filter:backdrop-blur-sm sm:hidden motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        desktopHidden={desktopHidden}
      />
      <MobileQuickAdd />
      <main className="flex flex-col flex-1 overflow-hidden">
        <Topbar onMenuClick={handleMenuClick} />
        <PwaInstallBanner />
        <div
          className="flex-1 overflow-y-auto"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto w-full max-w-[1400px]">
            <Suspense fallback={<LoadingState variant="page" />}>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  )
}
