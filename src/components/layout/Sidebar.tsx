import { useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
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
  Eye,
  Hash,
  Flag,
  Grid3x3,
} from 'lucide-react'
import { useActiveBrand } from '@/stores/activeBrand'
import { useBrands } from '@/hooks/useBrands'
import { useAuth } from '@/hooks/useAuth'
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

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { to: '/',       label: 'Dashboard',   icon: LayoutDashboard, end: true },
      { to: '/brands', label: 'Brands',      icon: Briefcase },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/research',                  label: 'Research',     icon: TrendingUp },
      { to: '/research?tab=competitors',  label: 'Competitors',  icon: Eye },
      { to: '/research?tab=seo',          label: 'SEO Keywords', icon: Hash },
    ],
  },
  {
    label: 'Create',
    items: [
      { to: '/content',  label: 'Content',  icon: Sparkles },
      { to: '/calendar', label: 'Calendar', icon: CalendarDays },
    ],
  },
  {
    label: 'Collaborate',
    items: [
      { to: '/campaigns',       label: 'Campaigns', icon: Flag },
      { to: '/workspace/tasks', label: 'Tasks',     icon: Grid3x3 },
      { to: '/workspace/team',  label: 'Team',      icon: UsersRound },
    ],
  },
  {
    label: 'Measure',
    items: [
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
  desktopHidden?: boolean
}

export function Sidebar({ open, onClose, desktopHidden = false }: SidebarProps) {
  const navigate = useNavigate()
  const { activeBrand, setActiveBrand } = useActiveBrand()
  const { brands } = useBrands()
  const { user } = useAuth()

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
    <aside
      className={cn(
        'flex w-[232px] flex-col border-r border-border bg-sidebar',
        'fixed inset-y-0 left-0 z-50 h-full transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full',
        desktopHidden ? 'sm:hidden' : 'sm:relative sm:translate-x-0',
      )}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
      }}
    >
      {/* Logo */}
      <div className="flex h-[52px] items-center gap-2.5 border-b border-border px-4 shrink-0">
        <img src="/logo.png" alt="Zek" className="h-[18px] w-auto dark:invert" />
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, letterSpacing: '-0.02em' }}>
          Studio
        </span>
        <span className="ml-auto rounded border border-border px-1.5 py-0.5 text-[9.5px] font-semibold text-muted-foreground">
          BETA
        </span>
      </div>

      {/* Brand Switcher */}
      <div className="border-b border-border p-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between px-2.5 h-11 sm:h-[38px] hover:bg-sidebar-accent border border-border rounded-[10px]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-[22px] w-[22px] shrink-0">
                  <AvatarFallback
                    className="text-[10px] font-semibold"
                    style={{ background: activeBrand?.color ?? '#B8C5D1' }}
                  >
                    {brandInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-left min-w-0">
                  <span className="truncate text-[12.5px] font-medium text-sidebar-foreground leading-tight">
                    {activeBrand?.name ?? 'Select a brand'}
                  </span>
                  {activeBrand?.instagram_handle && (
                    <span className="truncate text-[10.5px] text-muted-foreground leading-tight">
                      @{activeBrand.instagram_handle}
                    </span>
                  )}
                </div>
              </div>
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
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
                    className="text-[10px]"
                    style={{ background: brand.color ?? '#B8C5D1' }}
                  >
                    {brand.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{brand.name}</span>
              </DropdownMenuItem>
            ))}
            {brands.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => navigate('/brands?new=1')} className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              New brand
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/60">
              {group.label}
            </div>
            {group.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 h-11 sm:h-[30px] mx-1.5 px-2.5 rounded-[7px] text-[12.5px] font-medium transition-colors',
                    isActive
                      ? 'bg-accent/60 text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )
                }
              >
                <Icon className="h-[15px] w-[15px] shrink-0" />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2.5 flex items-center gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="h-[26px] w-[26px] rounded-full bg-muted text-foreground flex items-center justify-center text-[10px] font-semibold shrink-0">
            {user?.email?.slice(0, 2).toUpperCase() ?? 'ZS'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-sidebar-foreground leading-tight">
              {user?.email?.split('@')[0] ?? 'Account'}
            </div>
            <div className="truncate text-[10.5px] text-muted-foreground leading-tight">Owner</div>
          </div>
        </div>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          className="h-11 w-11 sm:h-[26px] sm:w-[26px] text-muted-foreground hover:text-foreground shrink-0"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </aside>
  )
}
