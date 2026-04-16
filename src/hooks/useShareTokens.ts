import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ShareToken, ShareTokenType } from '@/types'

export function useShareTokens(brandId: string | null) {
  const queryClient = useQueryClient()

  const tokens = useQuery({
    queryKey: ['share-tokens', brandId],
    queryFn: async () => {
      if (!brandId) return []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('share_tokens')
        .select('*')
        .eq('brand_id', brandId)
      if (error) throw error
      return (data ?? []) as ShareToken[]
    },
    enabled: !!brandId,
  })

  const createToken = useMutation({
    mutationFn: async ({
      type,
      settings,
    }: {
      type: ShareTokenType
      settings?: Record<string, unknown>
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('share_tokens')
        .insert({ brand_id: brandId, type, settings: settings ?? {} })
        .select()
        .single()
      if (error) throw error
      return data as ShareToken
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['share-tokens', brandId] }),
  })

  const deleteToken = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('share_tokens').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['share-tokens', brandId] }),
  })

  return { tokens, createToken, deleteToken }
}
