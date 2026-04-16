import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { BrandProfile } from '@/types'

export interface BrandUpsert {
  name: string
  niche: string
  target_location?: string | null
  website_url?: string | null
  platforms: string[]
  color?: string | null
  avatar_url?: string | null
  instagram_handle?: string | null
  tiktok_handle?: string | null
  facebook_handle?: string | null
  youtube_handle?: string | null
  linkedin_handle?: string | null
}

export function useBrands() {
  const queryClient = useQueryClient()

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as BrandProfile[]
    },
  })

  const createBrand = useMutation({
    mutationFn: async (values: BrandUpsert) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('brand_profiles')
        .insert({ ...values, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as BrandProfile
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
    },
  })

  const updateBrand = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<BrandUpsert> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('brand_profiles')
        .update(values)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as BrandProfile
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
    },
  })

  const deleteBrand = useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('brand_profiles')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
    },
  })

  return {
    brands,
    isLoading,
    createBrand,
    updateBrand,
    deleteBrand,
  }
}
