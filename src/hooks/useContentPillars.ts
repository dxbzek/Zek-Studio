import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ContentPillar, ContentPillarInsert } from '@/types'

export function useContentPillars(brandId: string | null) {
  const queryClient = useQueryClient()

  const pillars = useQuery({
    queryKey: ['content-pillars', brandId],
    queryFn: async () => {
      if (!brandId) return []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('content_pillars')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as ContentPillar[]
    },
    enabled: !!brandId,
  })

  const createPillar = useMutation({
    mutationFn: async (payload: ContentPillarInsert) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('content_pillars')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as ContentPillar
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-pillars', brandId] }),
  })

  const deletePillar = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('content_pillars').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-pillars', brandId] }),
  })

  return { pillars, createPillar, deletePillar }
}
