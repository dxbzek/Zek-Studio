import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { GeneratedContent, GenerateSource, ContentType, ContentTone, Platform } from '@/types'

export function useGenerator(brandId: string | null) {
  const queryClient = useQueryClient()

  const history = useQuery({
    queryKey: ['generated-content', brandId],
    queryFn: async () => {
      if (!brandId) return []
      const { data, error } = await (supabase as any)
        .from('generated_content')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []) as GeneratedContent[]
    },
    enabled: !!brandId,
  })

  const generate = useMutation({
    mutationFn: async (params: {
      type: ContentType
      platform: Platform
      tone: ContentTone
      source: GenerateSource
    }) => {
      if (!brandId) throw new Error('No brand selected')
      const { data, error } = await (supabase as any).functions.invoke('ai-generate', {
        body: { brand_id: brandId, ...params },
      })
      if (error) {
        try {
          const body = await error.context?.json?.()
          throw new Error(body?.error ?? body?.message ?? error.message)
        } catch (inner) {
          throw inner instanceof Error ? inner : error
        }
      }
      return data.record as GeneratedContent
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generated-content', brandId] })
    },
  })

  const saveToCalendar = useMutation({
    mutationFn: async ({
      output,
      type,
      platform,
      generatedContentId,
      scheduledDate,
    }: {
      output: string
      type: ContentType
      platform: Platform
      generatedContentId: string
      scheduledDate: string
    }) => {
      if (!brandId) throw new Error('No brand selected')
      const { data, error } = await (supabase as any)
        .from('calendar_entries')
        .insert({
          brand_id: brandId,
          platform,
          content_type: type,
          title: output.slice(0, 120),
          body: output,
          scheduled_date: scheduledDate,
          status: 'draft',
          generated_content_id: generatedContentId,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
  })

  return { history, generate, saveToCalendar }
}
