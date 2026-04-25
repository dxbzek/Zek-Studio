import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useActiveBrand } from '@/stores/activeBrand'
import type { BrandProfile } from '@/types'

// Explicit column list (matches the rest of the hook codebase pattern in
// useTasks/useCalendar). Same payload as `*`; the win is that any future
// brand_profiles column addition forces an intentional update here instead
// of silently bloating every consumer of useBrands.
const BRAND_COLUMNS =
  'id, user_id, name, niche, target_location, website_url, platforms, ' +
  'avatar_url, color, instagram_handle, tiktok_handle, facebook_handle, ' +
  'youtube_handle, linkedin_handle, created_at, updated_at'

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
        .select(BRAND_COLUMNS)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as BrandProfile[]
    },
    // Brand list rarely changes; a 5-minute floor keeps sidebar / dropdown /
    // multi-page consumers from refetching on every navigation.
    staleTime: 300_000,
  })

  const createBrand = useMutation({
    mutationFn: async (values: BrandUpsert) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { error } = await supabase
        .from('brand_profiles')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      if (useActiveBrand.getState().activeBrand?.id === deletedId) {
        useActiveBrand.getState().setActiveBrand(null)
      }
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
