import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { BrandKPI, BrandKPIInsert } from '@/types'

export function useBrandKPIs(brandId: string | null) {
  const queryClient = useQueryClient()
  const queryKey = ['brand-kpis', brandId] as const

  const kpis = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_kpis')
        .select('*')
        .eq('brand_id', brandId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as BrandKPI[]
    },
    enabled: !!brandId,
  })

  const upsertKPI = useMutation({
    mutationFn: async (payload: BrandKPIInsert) => {
      const { data, error } = await supabase
        .from('brand_kpis')
        .upsert(
          { ...payload, updated_at: new Date().toISOString() },
          { onConflict: 'brand_id,platform,metric' },
        )
        .select()
        .single()
      if (error) throw error
      return data as BrandKPI
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const deleteKPI = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('brand_kpis').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return { kpis, upsertKPI, deleteKPI }
}
