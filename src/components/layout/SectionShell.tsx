import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface Tab {
  to: string
  label: string
}

interface SectionShellProps {
  title: string
  tabs: Tab[]
  scrollable?: boolean
}

export function SectionShell({ title, tabs, scrollable = true }: SectionShellProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b border-border bg-background">
        <div className="px-6 pt-4 pb-0">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        </div>
        <nav className="flex gap-1 px-4 mt-3">
          {tabs.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className={cn('flex-1', scrollable ? 'overflow-y-auto' : 'overflow-hidden')}>
        <Outlet />
      </div>
    </div>
  )
}
