import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { setSentryUser } from '@/lib/sentry'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session. A rejected promise (e.g. transient network error on
    // boot) would otherwise leave loading stuck at true forever.
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        const u = session?.user ?? null
        setUser(u)
        setSentryUser(u ? { id: u.id, email: u.email } : null)
      })
      .catch((err) => console.error('[useAuth] getSession failed', err))
      .finally(() => setLoading(false))

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      setSentryUser(u ? { id: u.id, email: u.email } : null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, loading }
}
