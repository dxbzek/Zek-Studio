import { useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Briefcase,
  TrendingUp,
  Sparkles,
  CalendarDays,
  LogOut,
  ChevronDown,
  Plus,
  UsersRound,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActiveBrand } from '@/stores/activeBrand'
import { useBrands } from '@/hooks/useBrands'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

const NAV_ITEMS = [
  { to: '/',          label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/brands',    label: 'Brand Profiles', icon: Briefcase },
  { to: '/research',  label: 'Research',       icon: TrendingUp },
  { to: '/content',   label: 'Content',        icon: Sparkles },
  { to: '/calendar',  label: 'Calendar',       icon: CalendarDays },
  { to: '/workspace', label: 'Workspace',      icon: UsersRound },
  { to: '/analytics', label: 'Analytics',      icon: BarChart3 },
]

export function Sidebar() {
  const navigate = useNavigate()
  const { activeBrand, setActiveBrand } = useActiveBrand()
  const { brands } = useBrands()

  // Keep activeBrand in sync with latest data from the server
  useEffect(() => {
    if (activeBrand && brands.length > 0) {
      const fresh = brands.find((b) => b.id === activeBrand.id)
      if (fresh) setActiveBrand(fresh)
    }
  }, [brands])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setActiveBrand(null)
    navigate('/login')
  }

  const brandInitials = activeBrand
    ? activeBrand.name.slice(0, 2).toUpperCase()
    : 'ZS'

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold tracking-tight text-sidebar-foreground">
          Zek Studio
        </span>
      </div>

      {/* Brand Switcher */}
      <div className="border-b border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between px-2 hover:bg-sidebar-accent"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback
                    className="text-xs"
                    style={{ background: activeBrand?.color ?? '#6366f1' }}
                  >
                    {brandInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-medium text-sidebar-foreground">
                  {activeBrand?.name ?? 'Select a brand'}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-52" align="start">
            {brands.map((brand) => (
              <DropdownMenuItem
                key={brand.id}
                onClick={() => setActiveBrand(brand)}
                className="gap-2"
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback
                    className="text-xs"
                    style={{ background: brand.color ?? '#6366f1' }}
                  >
                    {brand.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{brand.name}</span>
              </DropdownMenuItem>
            ))}
            {brands.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => navigate('/brands?new=1')} className="gap-2">
              <Plus className="h-4 w-4" />
              Add brand
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 flex items-center justify-between">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  )
}
