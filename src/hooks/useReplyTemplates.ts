import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ReplyTemplate, ReplyTemplateInsert } from '@/types'

export function useReplyTemplates(brandId: string | null) {
  const queryClient = useQueryClient()

  const templates = useQuery({
    queryKey: ['reply-templates', brandId],
    queryFn: async () => {
      if (!brandId) return []
      const { data, error } = await supabase
        .from('reply_templates')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ReplyTemplate[]
    },
    enabled: !!brandId,
  })

  const createTemplate = useMutation({
    mutationFn: async (payload: ReplyTemplateInsert) => {
      const { data, error } = await supabase
        .from('reply_templates')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as ReplyTemplate
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reply-templates', brandId] }),
  })

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reply_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reply-templates', brandId] }),
  })

  return { templates, createTemplate, deleteTemplate }
}
