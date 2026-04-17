import { NavLink, Outlet } from 'react-router-dom'

const TAB = 'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap'
const ACTIVE = 'border-primary text-foreground'
const INACTIVE = 'border-transparent text-muted-foreground hover:text-foreground'

export function ResearchShell() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 border-b border-border px-4 shrink-0 bg-background">
        <NavLink to="/research/niche" className={({ isActive }) => `${TAB} ${isActive ? ACTIVE : INACTIVE}`}>
          Niche Research
        </NavLink>
        <NavLink to="/research/competitors" className={({ isActive }) => `${TAB} ${isActive ? ACTIVE : INACTIVE}`}>
          Competitors
        </NavLink>
        <NavLink to="/research/seo" className={({ isActive }) => `${TAB} ${isActive ? ACTIVE : INACTIVE}`}>
          SEO
        </NavLink>
      </div>
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
