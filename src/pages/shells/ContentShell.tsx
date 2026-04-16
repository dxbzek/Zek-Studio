import { NavLink, Outlet } from 'react-router-dom'

const TAB = 'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap'
const ACTIVE = 'border-primary text-foreground'
const INACTIVE = 'border-transparent text-muted-foreground hover:text-foreground'

export function ContentShell() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 border-b border-border px-4 shrink-0 bg-background">
        <NavLink to="/content/generator" className={({ isActive }) => `${TAB} ${isActive ? ACTIVE : INACTIVE}`}>
          AI Generator
        </NavLink>
        <NavLink to="/content/templates" className={({ isActive }) => `${TAB} ${isActive ? ACTIVE : INACTIVE}`}>
          Reply Templates
        </NavLink>
      </div>
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
