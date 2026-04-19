import { useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { SpecialistShell } from './SpecialistShell'
import { useAuth } from '@/hooks/useAuth'
import { useIsSpecialist } from '@/hooks/useTeam'
import { Button } from '@/components/ui/button'
import TaskBoardPage from '@/pages/TaskBoardPage'

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

  // Specialists see only their task board, with minimal UI
  if (isSpecialist) {
    return (
      <SpecialistShell>
        <TaskBoardPage isSpecialist />
      </SpecialistShell>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 overflow-y-auto">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-background px-4 sm:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold text-sm tracking-tight">Zek Studio</span>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
