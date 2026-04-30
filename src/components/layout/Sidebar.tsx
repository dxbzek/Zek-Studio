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
import { BrandAvatar } from '@/components/brand/BrandAvatar'
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

  return (
    <aside
      className={cn(
        'relative flex w-[232px] flex-col border-r border-sidebar-border/80 bg-sidebar',
        'fixed inset-y-0 left-0 z-50 h-full transition-transform duration-200',
        // Subtle vertical wash to separate from main content without harsh contrast
        'before:absolute before:inset-0 before:pointer-events-none before:bg-gradient-to-b before:from-transparent before:via-transparent before:to-foreground/[0.02] dark:before:to-black/30',
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
      <div className="relative flex h-[52px] items-center gap-2.5 border-b border-sidebar-border/80 px-4 shrink-0">
        <img src="/logo.png" alt="Zek" className="h-[18px] w-auto dark:invert transition-transform duration-200 ease-out hover:scale-105" />
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, letterSpacing: '-0.02em' }}>
          Studio
        </span>
        <span
          className="ml-auto rounded-[5px] border border-border/80 bg-card/60 px-1.5 py-[1px] text-[9px] font-semibold tracking-[0.08em] text-muted-foreground"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          BETA
        </span>
      </div>

      {/* Brand Switcher */}
      <div className="relative border-b border-sidebar-border/80 p-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between px-2.5 h-11 sm:h-[40px] hover:bg-sidebar-accent border border-border/80 bg-card/40 rounded-[10px] shadow-[0_1px_0_0_color-mix(in_oklch,white_50%,transparent)_inset] transition-all duration-150 hover:border-foreground/15 hover:-translate-y-px hover:shadow-[0_1px_0_0_color-mix(in_oklch,white_60%,transparent)_inset,0_2px_8px_-2px_color-mix(in_oklch,black_10%,transparent)] active:translate-y-0 dark:bg-input/20 dark:shadow-none"
            >
              <div className="flex items-center gap-2 min-w-0">
                <BrandAvatar brand={activeBrand} size={22} rounded="full" />
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
                <BrandAvatar brand={brand} size={20} rounded="full" />
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
      <nav className="relative flex-1 overflow-y-auto py-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div
              className="px-3 pt-3 pb-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/55"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
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
                    'group/nav relative flex items-center gap-2.5 h-11 sm:h-[32px] mx-1.5 px-2.5 rounded-[8px] text-[12.5px] font-medium transition-all duration-150 ease-out',
                    // Left accent bar — visible on active, subtle on hover
                    'before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:rounded-r-full before:transition-all before:duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-accent to-accent/30 text-foreground shadow-[0_1px_0_0_color-mix(in_oklch,white_50%,transparent)_inset] before:h-5 before:bg-foreground dark:shadow-none'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground hover:translate-x-px before:h-0 before:bg-foreground/40 hover:before:h-3'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'h-[15px] w-[15px] shrink-0 transition-colors',
                        isActive ? 'text-foreground' : 'text-muted-foreground/70 group-hover/nav:text-foreground',
                      )}
                    />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="relative border-t border-sidebar-border/80 p-2.5 flex items-center gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className="h-[26px] w-[26px] rounded-full text-foreground flex items-center justify-center text-[10px] font-semibold shrink-0 ring-1 ring-border/60 shadow-[0_1px_0_0_color-mix(in_oklch,white_60%,transparent)_inset]"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in oklch, var(--accent) 60%, var(--card)) 0%, var(--muted) 100%)',
            }}
          >
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
          aria-label="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </aside>
  )
}
