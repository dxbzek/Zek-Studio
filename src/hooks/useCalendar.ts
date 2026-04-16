import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from 'date-fns'
import type { CalendarEntry, CalendarEntryInsert, CalendarEntryUpdate } from '@/types'

export function useCalendar(brandId: string | null, year: number, month: number) {
  const queryClient = useQueryClient()
  const queryKey = ['calendar-entries', brandId, year, month] as const

  const firstDay  = startOfMonth(new Date(year, month))
  const gridStart = format(startOfWeek(firstDay, { weekStartsOn: 0 }), 'yyyy-MM-dd')
  const gridEnd   = format(endOfWeek(endOfMonth(firstDay), { weekStartsOn: 0 }), 'yyyy-MM-dd')

  const entries = useQuery({
    queryKey,
    queryFn: async () => {
      if (!brandId) return []
      const { data, error } = await (supabase as any)
        .from('calendar_entries')
        .select('*')
        .eq('brand_id', brandId)
        .gte('scheduled_date', gridStart)
        .lte('scheduled_date', gridEnd)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as CalendarEntry[]
    },
    enabled: !!brandId,
  })

  const createEntry = useMutation({
    mutationFn: async (payload: CalendarEntryInsert) => {
      const { data, error } = await (supabase as any)
        .from('calendar_entries')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as CalendarEntry
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['calendar-entries', brandId] }),
  })

  const updateEntry = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: CalendarEntryUpdate }) => {
      const { data, error } = await (supabase as any)
        .from('calendar_entries')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as CalendarEntry
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<CalendarEntry[]>(queryKey)
      queryClient.setQueryData<CalendarEntry[]>(queryKey,
        (old) => old?.map((e) => e.id === id ? { ...e, ...patch } : e) ?? [])
      return { previous }
    },
    onError: (_err: unknown, _vars: unknown, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ['calendar-entries', brandId] }),
  })

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('calendar_entries')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['calendar-entries', brandId] }),
  })

  return { entries, createEntry, updateEntry, deleteEntry }
}

export function useGeneratedContent(id: string | null) {
  return useQuery({
    queryKey: ['generated-content-single', id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('generated_content')
        .select('id, brief, type, platform, tone, created_at')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as { id: string; brief: string; type: string; platform: string; tone: string; created_at: string }
    },
    enabled: !!id,
    staleTime: Infinity,
  })
}
