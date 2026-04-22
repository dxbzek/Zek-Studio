import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { NicheResearchResults } from '@/types'

export function useNicheResearch(brandId: string | null, niche: string | null, location?: string | null) {
  const queryClient = useQueryClient()
  const loc = location?.trim() || null
  const cacheKey = niche ? `${niche.toLowerCase().trim()}${loc ? `:${loc.toLowerCase()}` : ''}` : null

  const { data, isLoading, error } = useQuery({
    queryKey: ['niche-research', brandId, cacheKey],
    queryFn: async () => {
      if (!brandId || !cacheKey) return null
      const { data, error } = await supabase
        .from('niche_research_cache')
        .select('*')
        .eq('brand_id', brandId)
        .eq('query', cacheKey)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!brandId && !!niche,
  })

  const refresh = useMutation({
    mutationFn: async () => {
      if (!brandId || !niche) throw new Error('No brand selected')
      const { data, error } = await supabase.functions.invoke('niche-research', {
        body: { brand_id: brandId, niche, location: loc },
      })
      if (error) {
        try {
          const body = await error.context?.json?.()
          throw new Error(body?.error ?? body?.message ?? error.message)
        } catch (inner) {
          throw inner instanceof Error ? inner : error
        }
      }
      return data as { results: NicheResearchResults; cached: boolean }
    },
    // Invalidate every cached niche+location combo for this brand — prefix match.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['niche-research', brandId] })
    },
  })

  return {
    cache: data,
    results: (data?.results ?? null) as NicheResearchResults | null,
    fetchedAt: (data?.fetched_at ?? null) as string | null,
    isLoading,
    error,
    refresh,
  }
}
