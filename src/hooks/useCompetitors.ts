import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Competitor, CompetitorPost, SavedHook, Platform } from '@/types'

// ─── Competitors ──────────────────────────────────────────────────────────────

export function useCompetitors(brandId: string | null) {
  const queryClient = useQueryClient()

  const { data: competitors = [], isLoading: competitorsLoading } = useQuery({
    queryKey: ['competitors', brandId],
    queryFn: async () => {
      if (!brandId) return []
      const { data, error } = await (supabase as any)
        .from('competitors')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Competitor[]
    },
    enabled: !!brandId,
  })

  const runResearch = useMutation({
    mutationFn: async ({ handle, platform }: { handle: string; platform: Platform }) => {
      if (!brandId) throw new Error('No brand selected')

      const { data, error } = await (supabase as any).functions.invoke('competitor-research', {
        body: { brand_id: brandId, handle, platform },
      })
      if (error) {
        // Unwrap the actual body from FunctionsHttpError so the toast is informative
        try {
          const body = await error.context?.json?.()
          throw new Error(body?.error ?? body?.message ?? error.message)
        } catch (inner) {
          throw inner instanceof Error ? inner : error
        }
      }
      return data as { competitor: Competitor; posts: CompetitorPost[] }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitors', brandId] })
      queryClient.invalidateQueries({ queryKey: ['competitor-posts', brandId] })
    },
  })

  const deleteCompetitor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('competitors')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitors', brandId] })
      queryClient.invalidateQueries({ queryKey: ['competitor-posts', brandId] })
    },
  })

  const transcribePost = useMutation({
    mutationFn: async ({ postId, videoUrl }: { postId: string; videoUrl: string }) => {
      const { data, error } = await (supabase as any).functions.invoke('transcribe-video', {
        body: { post_id: postId, video_url: videoUrl },
      })
      if (error) {
        try {
          const body = await error.context?.json?.()
          throw new Error(body?.error ?? body?.message ?? error.message)
        } catch (inner) {
          throw inner instanceof Error ? inner : error
        }
      }
      return data as { transcript: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitor-posts', brandId] })
    },
  })

  return { competitors, competitorsLoading, runResearch, deleteCompetitor, transcribePost }
}

// ─── Competitor Posts ─────────────────────────────────────────────────────────

export function useCompetitorPosts(brandId: string | null, competitorId?: string | null) {
  return useQuery({
    queryKey: ['competitor-posts', brandId, competitorId],
    queryFn: async () => {
      if (!brandId) return []
      let query = (supabase as any)
        .from('competitor_posts')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })

      if (competitorId) {
        query = query.eq('competitor_id', competitorId)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as CompetitorPost[]
    },
    enabled: !!brandId,
  })
}

// ─── Saved Hooks ─────────────────────────────────────────────────────────────

export function useSavedHooks(brandId: string | null) {
  const queryClient = useQueryClient()

  const { data: savedHooks = [], isLoading } = useQuery({
    queryKey: ['saved-hooks', brandId],
    queryFn: async () => {
      if (!brandId) return []
      const { data, error } = await (supabase as any)
        .from('saved_hooks')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as SavedHook[]
    },
    enabled: !!brandId,
  })

  const saveHook = useMutation({
    mutationFn: async ({
      text,
      source_post_id,
      platform,
    }: {
      text: string
      source_post_id?: string
      platform?: Platform
    }) => {
      if (!brandId) throw new Error('No brand selected')
      const { data, error } = await (supabase as any)
        .from('saved_hooks')
        .insert({
          brand_id: brandId,
          text,
          source_post_id: source_post_id ?? null,
          platform: platform ?? null,
          tags: [],
        })
        .select()
        .single()
      if (error) throw error
      return data as SavedHook
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-hooks', brandId] })
    },
  })

  const deleteHook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('saved_hooks')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-hooks', brandId] })
    },
  })

  return { savedHooks, isLoading, saveHook, deleteHook }
}
