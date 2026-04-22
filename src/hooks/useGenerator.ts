import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { GeneratedContent, GenerateSource, ContentType, ContentTheme, ContentTone, GeneratorPlatform, Platform } from '@/types'

const THEME_TO_CONTENT_TYPE: Record<string, ContentType> = {
  property_tour:     'listing',
  market_update:     'market',
  agent_recruitment: 'story',
  client_story:      'story',
  investment_tips:   'caption',
  behind_scenes:     'story',
  new_launch:        'listing',
  area_spotlight:    'caption',
}

export function useGenerator(brandId: string | null) {
  const queryClient = useQueryClient()
  const [historyLimit, setHistoryLimit] = useState(20)
  const loadMore = useCallback(() => setHistoryLimit((n) => n + 20), [])

  const history = useQuery({
    queryKey: ['generated-content', brandId, historyLimit],
    queryFn: async () => {
      if (!brandId) return []
      const { data, error } = await supabase
        .from('generated_content')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(historyLimit)
      if (error) throw error
      return (data ?? []) as GeneratedContent[]
    },
    enabled: !!brandId,
  })

  const generate = useMutation({
    mutationFn: async (params: {
      theme: ContentTheme
      platform: GeneratorPlatform
      tone: ContentTone
      source: GenerateSource
    }) => {
      if (!brandId) throw new Error('No brand selected')
      const { data, error } = await supabase.functions.invoke('ai-generate', {
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
      // Use the closure brandId, not the server-echoed value, so the invalidate
      // always targets the cache the current component is reading from.
      queryClient.invalidateQueries({ queryKey: ['generated-content', brandId] })
    },
  })

  const saveToCalendar = useMutation({
    mutationFn: async ({
      output,
      theme,
      platform,
      generatedContentId,
      scheduledDate,
      sectionContentType,
    }: {
      output: string
      theme: string
      platform: Platform
      generatedContentId: string
      scheduledDate: string
      sectionContentType?: ContentType
    }) => {
      if (!brandId) throw new Error('No brand selected')
      const contentType: ContentType = sectionContentType ?? THEME_TO_CONTENT_TYPE[theme] ?? 'caption'
      const title = output.slice(0, 120)
      const { data: entry, error } = await supabase
        .from('calendar_entries')
        .insert({
          brand_id: brandId,
          platform,
          content_type: contentType,
          title,
          body: output,
          scheduled_date: scheduledDate,
          status: 'draft',
          generated_content_id: generatedContentId,
        })
        .select()
        .single()
      if (error) throw error

      // Mirror the Calendar drawer: every entry gets a linked task so it
      // shows up on the Tasks board.
      const { error: taskError } = await supabase.from('tasks').insert({
        brand_id: brandId,
        title,
        description: null,
        type: 'content',
        status: 'todo',
        priority: 'medium',
        assignee_id: null,
        assignee_email: null,
        calendar_entry_id: entry.id,
        due_date: scheduledDate,
        created_by: null,
      })
      if (taskError) throw taskError

      return entry
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-entries', entry.brand_id] })
      queryClient.invalidateQueries({ queryKey: ['tasks', entry.brand_id] })
    },
  })

  const saveHook = useMutation({
    mutationFn: async ({ text, platform }: { text: string; platform: GeneratorPlatform }) => {
      if (!brandId) throw new Error('No brand selected')
      const storedPlatform = platform === 'meta' ? 'instagram' : platform
      const { error } = await supabase.from('saved_hooks').insert({
        brand_id: brandId,
        text,
        platform: storedPlatform,
        tags: [],
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-hooks', brandId] })
    },
  })

  return { history, generate, saveToCalendar, saveHook, loadMore, historyLimit }
}
