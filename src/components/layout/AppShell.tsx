import { Suspense, useState } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { SpecialistShell } from './SpecialistShell'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '@/hooks/useAuth'
import { useIsSpecialist } from '@/hooks/useTeam'
import { Button } from '@/components/ui/button'

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
    <header className="sticky top-0 z-30 flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      {/* Hamburger — mobile only */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 sm:hidden"
        onClick={onMenuClick}
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

export function AppShell() {
  const { user, loading: authLoading } = useAuth()
  const { data: isSpecialist, isLoading: roleLoading } = useIsSpecialist()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (authLoading || (user && roleLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex flex-col flex-1 overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex-1 overflow-y-auto">
          <Suspense
            fallback={
              <div className="flex min-h-[40vh] items-center justify-center">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
