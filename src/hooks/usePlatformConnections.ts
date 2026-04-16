import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useBrandSync(brandId: string | null) {
  const queryClient = useQueryClient()

  const sync = useMutation({
    mutationFn: async (platform: string) => {
      // getUser() makes a live network call and returns a fresh token
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) throw new Error('Not authenticated')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('No active session')

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-brand-analytics`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ brand_id: brandId, platform }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
      return json as { synced: number }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-metrics', brandId] })
    },
  })

  return { sync }
}
