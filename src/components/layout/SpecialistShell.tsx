import { lazy, Suspense, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { MoonStar, Sun, LogOut, LayoutList, CalendarDays, ChevronDown } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useBrands } from '@/hooks/useBrands'
import { useActiveBrand } from '@/stores/activeBrand'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BrandAvatar } from '@/components/brand/BrandAvatar'

const TaskBoardPage       = lazy(() => import('@/pages/TaskBoardPage'))
const ContentCalendarPage = lazy(() => import('@/pages/ContentCalendarPage').then(m => ({ default: m.ContentCalendarPage })))

type Page = 'tasks' | 'calendar'

const NAV: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'tasks',    label: 'Tasks',    icon: LayoutList },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
]

export function SpecialistShell() {
  const { theme, setTheme } = useTheme()
  const [page, setPage] = useState<Page>('tasks')
  const { brands } = useBrands()
  const { activeBrand, setActiveBrand } = useActiveBrand()

  // Auto-seed: if no active brand yet, pick the first accessible one.
  // Also re-seed if the currently-active brand is no longer in the accessible
  // list (e.g. the owner just revoked access — fall back to whatever remains).
  useEffect(() => {
    if (brands.length === 0) return
    if (!activeBrand) {
      setActiveBrand(brands[0])
      return
    }
    const stillHasAccess = brands.some((b) => b.id === activeBrand.id)
    if (!stillHasAccess) setActiveBrand(brands[0])
  }, [brands, activeBrand, setActiveBrand])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-5 min-w-0">
          <span
            style={{ fontFamily: 'var(--font-heading)', fontSize: 15, letterSpacing: '-0.02em' }}
            className="shrink-0"
          >
            Zek Studio
          </span>

          {/* Brand switcher — only shown when the specialist has 2+ brands */}
          {brands.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 min-w-0 max-w-[200px] px-2 py-1 rounded-md border border-border bg-background hover:bg-accent transition-colors"
                >
                  <BrandAvatar brand={activeBrand} size={20} rounded="full" />
                  <span className="truncate text-[12.5px] font-medium">
                    {activeBrand?.name ?? 'Select brand'}
                  </span>
                  <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                  Switch brand
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {brands.map((brand) => (
                  <DropdownMenuItem
                    key={brand.id}
                    onClick={() => setActiveBrand(brand)}
                    className="gap-2"
                  >
                    <BrandAvatar brand={brand} size={20} rounded="full" />
                    <span className="truncate">{brand.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : activeBrand ? (
            <div className="flex items-center gap-2 min-w-0 px-2 py-1">
              <BrandAvatar brand={activeBrand} size={20} rounded="full" />
              <span className="truncate text-[12.5px] font-medium">{activeBrand.name}</span>
            </div>
          ) : null}

          <nav className="flex items-center gap-1 shrink-0">
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
        <div className="flex items-center gap-2 shrink-0">
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
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden />
            </div>
          }
        >
          {page === 'tasks'    && <TaskBoardPage isSpecialist />}
          {page === 'calendar' && <ContentCalendarPage />}
        </Suspense>
      </main>
    </div>
  )
}
