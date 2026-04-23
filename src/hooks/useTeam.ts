import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useBrands } from '@/hooks/useBrands'
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

/**
 * Cross-brand team view for the owner. Returns every team_members row across
 * every brand the owner manages, so the Team page can group by email and let
 * the owner see who has access to what.
 */
export function useAllTeam() {
  const queryClient = useQueryClient()
  const { brands } = useBrands()
  const brandIds = brands.map((b) => b.id).sort()
  const queryKey = ['all-team', brandIds] as const

  const members = useQuery({
    queryKey,
    queryFn: async () => {
      if (brandIds.length === 0) return []
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .in('brand_id', brandIds)
        .order('invited_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as TeamMember[]
    },
    enabled: brandIds.length > 0,
  })

  // Grant access: wraps the invite-member Edge Function so the email-exists /
  // needs-invite branching stays in one place. If the email already has an
  // account and a row for this brand, the function returns a friendly error
  // we surface to the UI.
  const grantAccess = useMutation({
    mutationFn: async ({ email, brandId }: { email: string; brandId: string }) => {
      const normalized = email.trim().toLowerCase()
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: { email: normalized, brand_id: brandId },
      })
      if (error) {
        let msg = (error as Error).message
        try {
          const body = await (error as { context?: { json?: () => Promise<unknown> } }).context?.json?.()
          const b = body as { error?: string; message?: string } | undefined
          if (b?.error) msg = b.error
          else if (b?.message) msg = b.message
        } catch { /* non-JSON body; keep default */ }
        throw new Error(msg)
      }
      return data as {
        member?: TeamMember
        emailed?: boolean
        alreadyRegistered?: boolean
        actionLink?: string
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all-team'] }),
  })

  const revokeAccess = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('team_members').delete().eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all-team'] }),
  })

  return { members, grantAccess, revokeAccess }
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
        .from('brand_profiles').select('*').eq('id', brandId).maybeSingle()
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
