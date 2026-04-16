import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { SpecialistShell } from './SpecialistShell'
import { useAuth } from '@/hooks/useAuth'
import { useIsSpecialist } from '@/hooks/useTeam'
import TaskBoardPage from '@/pages/TaskBoardPage'

export function AppShell() {
  const { user, loading: authLoading } = useAuth()
  const { data: isSpecialist, isLoading: roleLoading } = useIsSpecialist()

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
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
