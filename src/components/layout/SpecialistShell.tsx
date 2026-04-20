import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MoonStar, Sun, LogOut, LayoutList, CalendarDays } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import TaskBoardPage from '@/pages/TaskBoardPage'
import { ContentCalendarPage } from '@/pages/ContentCalendarPage'

type Page = 'tasks' | 'calendar'

const NAV: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'tasks',    label: 'Tasks',    icon: LayoutList },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
]

export function SpecialistShell() {
  const { theme, setTheme } = useTheme()
  const [page, setPage] = useState<Page>('tasks')

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-5">
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, letterSpacing: '-0.02em' }}>
            Zek Studio
          </span>
          <nav className="flex items-center gap-1">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPage(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors',
                  page === id
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        {page === 'tasks'    && <TaskBoardPage isSpecialist />}
        {page === 'calendar' && <ContentCalendarPage />}
      </main>
    </div>
  )
}
