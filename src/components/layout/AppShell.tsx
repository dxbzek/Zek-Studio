import { useState } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { Menu, Bell, Plus } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { SpecialistShell } from './SpecialistShell'
import { ThemeToggle } from './ThemeToggle'
import { useAuth } from '@/hooks/useAuth'
import { useIsSpecialist } from '@/hooks/useTeam'
import { Button } from '@/components/ui/button'
import TaskBoardPage from '@/pages/TaskBoardPage'

const ROUTE_MAP: Record<string, [string, string]> = {
  '/':                   ['Workspace',     'Dashboard'],
  '/brands':             ['Workspace',     'Brands'],
  '/research':           ['Intelligence',  'Research'],
  '/content':            ['Create',        'Content'],
  '/content/replies':    ['Create',        'Reply Templates'],
  '/calendar':           ['Create',        'Calendar'],
  '/campaigns':          ['Collaborate',   'Campaigns'],
  '/tasks':              ['Collaborate',   'Tasks'],
  '/workspace':          ['Collaborate',   'Team'],
  '/analytics':          ['Measure',       'Analytics'],
  '/report':             ['Measure',       'Public Report'],
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
        {/* Search pill — hidden on very small screens */}
        <div className="hidden sm:flex h-[30px] min-w-[180px] items-center gap-2 px-3 border border-border rounded-lg bg-card text-[12px] text-muted-foreground cursor-pointer hover:border-border/80 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <span className="flex-1">Search</span>
          <kbd className="text-[10px] bg-muted border border-border rounded px-1 py-0.5 font-mono">⌘K</kbd>
        </div>

        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
        </Button>

        <ThemeToggle />

        <Button size="sm" className="h-[30px] gap-1.5 px-3 text-[12px]">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New</span>
        </Button>
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
    return (
      <SpecialistShell>
        <TaskBoardPage isSpecialist />
      </SpecialistShell>
    )
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
          <Outlet />
        </div>
      </main>
    </div>
  )
}
