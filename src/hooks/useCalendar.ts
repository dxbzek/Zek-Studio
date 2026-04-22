import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
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
      const { data, error } = await supabase
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

  // Refetch when calendar_entries change out-of-band — e.g. the DB trigger
  // tasks_sync_calendar_status rewrites ce.status when a task moves columns.
  useEffect(() => {
    if (!brandId) return
    const channel = supabase
      .channel(`calendar-entries:${brandId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_entries', filter: `brand_id=eq.${brandId}` },
        () => queryClient.invalidateQueries({ queryKey: ['calendar-entries', brandId] }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [brandId]) // eslint-disable-line react-hooks/exhaustive-deps

  const createEntry = useMutation({
    mutationFn: async (payload: CalendarEntryInsert) => {
      const { data, error } = await supabase
        .from('calendar_entries')
        .insert(payload as any)
        .select()
        .single()
      if (error) throw error
      return data as CalendarEntry
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['calendar-entries', brandId] }),
  })

  const updateEntry = useMutation<CalendarEntry, Error, { id: string; patch: CalendarEntryUpdate }>({
    mutationFn: async ({ id, patch }) => {
      const { data, error } = await supabase
        .from('calendar_entries')
        .update({ ...patch, updated_at: new Date().toISOString() } as any)
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
    onError: (_err: unknown, _vars: unknown, ctx: unknown) => {
      const c = ctx as { previous: CalendarEntry[] | undefined } | undefined
      if (c?.previous) queryClient.setQueryData(queryKey, c.previous)
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ['calendar-entries', brandId] }),
  })

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
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
      const { data, error } = await supabase
        .from('generated_content')
        .select('id, brief, type, platform, tone, created_at')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as { id: string; brief: string; type: string; platform: string; tone: string; created_at: string }
    },
    enabled: !!id,
    staleTime: Infinity,
  })
}
