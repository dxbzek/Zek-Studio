import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Campaign, CampaignInsert, CampaignUpdate } from '@/types'

export function useCampaigns(brandId: string | null) {
  const queryClient = useQueryClient()

  const campaigns = useQuery({
    queryKey: ['campaigns', brandId],
    queryFn: async () => {
      if (!brandId) return []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('campaigns')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Campaign[]
    },
    enabled: !!brandId,
  })

  const createCampaign = useMutation({
    mutationFn: async (payload: CampaignInsert) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('campaigns')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as Campaign
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns', brandId] }),
  })

  const updateCampaign = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: CampaignUpdate }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('campaigns')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Campaign
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns', brandId] }),
  })

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('campaigns').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns', brandId] }),
  })

  return { campaigns, createCampaign, updateCampaign, deleteCampaign }
}
