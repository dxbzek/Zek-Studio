import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PostMetric, PostMetricInsert, PostMetricUpdate } from '@/types'

export function usePostMetrics(brandId: string | null) {
  const queryClient = useQueryClient()
  const queryKey = ['post-metrics', brandId] as const

  const metrics = useQuery({
    queryKey,
    queryFn: async () => {
      if (!brandId) return []
      const { data, error } = await supabase
        .from('post_metrics')
        .select('*')
        .eq('brand_id', brandId)
        .order('posted_at', { ascending: false, nullsFirst: false })
      if (error) throw error
      return (data ?? []) as PostMetric[]
    },
    enabled: !!brandId,
    // Metrics get logged at most a few times a day. 10-minute cache means
    // /analytics navigation stays instant inside a session.
    staleTime: 600_000,
  })

  const logMetric = useMutation({
    mutationFn: async (payload: PostMetricInsert) => {
      const { data, error } = await supabase
        .from('post_metrics')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PostMetric
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const updateMetric = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: PostMetricUpdate }) => {
      const { data, error } = await supabase
        .from('post_metrics')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PostMetric
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const deleteMetric = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('post_metrics')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return { metrics, logMetric, updateMetric, deleteMetric }
}
