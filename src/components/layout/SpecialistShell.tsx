import { supabase } from '@/lib/supabase'
import { MoonStar, Sun, LogOut } from 'lucide-react'
import { useTheme } from 'next-themes'

export function SpecialistShell({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme()

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Minimal top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <span className="text-sm font-semibold text-foreground">Zek Studio</span>
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
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
