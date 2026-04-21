import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TeamMember, BrandProfile } from '@/types'

export function useTeam(brandId: string | null) {
  const queryClient = useQueryClient()
  const queryKey = ['team-members', brandId] as const

  const members = useQuery({
    queryKey,
    queryFn: async () => {
      if (!brandId) return []
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('brand_id', brandId)
        .order('invited_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as TeamMember[]
    },
    enabled: !!brandId,
  })

  const invite = useMutation({
    mutationFn: async (email: string) => {
      if (!brandId) throw new Error('No brand selected')
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: { email, brand_id: brandId },
      })
      if (error) {
        // supabase-js surfaces non-2xx responses as FunctionsHttpError; the
        // actual JSON body (with our explicit `error` field) is on .context.
        // Parsing can throw on non-JSON responses — swallow and fall back.
        let msg = error.message
        try {
          const body = await error.context?.json?.()
          if (body?.error) msg = body.error
          else if (body?.message) msg = body.message
        } catch { /* non-JSON body; keep default message */ }
        throw new Error(msg)
      }
      return data.member as TeamMember
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const reassignBrand = useMutation({
    mutationFn: async ({ memberId, newBrandId }: { memberId: string; newBrandId: string }) => {
      const { error } = await supabase
        .from('team_members')
        .update({ brand_id: newBrandId } as any)
        .eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return { members, invite, removeMember, reassignBrand }
}

/** Returns the first brand the specialist belongs to (for auto-seeding activeBrand) */
export function useSpecialistBrand() {
  return useQuery({
    queryKey: ['specialist-brand'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      // Try by user_id first, fall back to email (handles unconfirmed invites)
      let brandId: string | null = null
      const { data: byId } = await supabase
        .from('team_members').select('brand_id').eq('user_id', user.id).limit(1)
      brandId = byId?.[0]?.brand_id ?? null

      if (!brandId && user.email) {
        const { data: byEmail } = await supabase
          .from('team_members').select('brand_id').eq('email', user.email.toLowerCase()).limit(1)
        brandId = byEmail?.[0]?.brand_id ?? null

        // Backfill user_id so future lookups are faster
        if (brandId) {
          await supabase.from('team_members')
            .update({ user_id: user.id })
            .eq('email', user.email.toLowerCase())
            .is('user_id', null)
        }
      }

      if (!brandId) return null
      const { data: brand } = await supabase
        .from('brand_profiles').select('*').eq('id', brandId).single()
      return (brand ?? null) as BrandProfile | null
    },
    staleTime: 5 * 60 * 1000,
  })
}

/** Returns true if the current user is a specialist (not an owner) on any brand */
export function useIsSpecialist() {
  return useQuery({
    queryKey: ['is-specialist'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false
      const { data: byId } = await supabase
        .from('team_members').select('id').eq('user_id', user.id).limit(1)
      if (Array.isArray(byId) && byId.length > 0) return true
      // Fall back to email match (user_id may be null for unconfirmed invites)
      if (user.email) {
        const { data: byEmail } = await supabase
          .from('team_members').select('id').eq('email', user.email.toLowerCase()).limit(1)
        return Array.isArray(byEmail) && byEmail.length > 0
      }
      return false
    },
    staleTime: 5 * 60 * 1000,
  })
}
