import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TeamMember } from '@/types'

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
        try {
          const body = await error.context?.json?.()
          throw new Error(body?.error ?? body?.message ?? error.message)
        } catch (inner) {
          throw inner instanceof Error ? inner : error
        }
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

  return { members, invite, removeMember }
}

/** Returns true if the current user is a specialist (not an owner) on any brand */
export function useIsSpecialist() {
  return useQuery({
    queryKey: ['is-specialist'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false
      const { data } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
      return Array.isArray(data) && data.length > 0
    },
    staleTime: 5 * 60 * 1000,
  })
}
