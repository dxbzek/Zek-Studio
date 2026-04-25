import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task, TaskInsert, TaskUpdate } from '@/types'

// Explicit column list (not select *) so a schema addition requires an
// intentional update here and accidental additions don't bloat the payload.
const TASK_COLUMNS =
  'id, brand_id, title, description, type, status, priority, ' +
  'assignee_id, assignee_email, calendar_entry_id, due_date, ' +
  'sort_order, created_by, created_at, updated_at'

/** Owner: all tasks for a brand */
export function useTasks(brandId: string | null) {
  const queryClient = useQueryClient()
  const queryKey = ['tasks', brandId] as const

  const tasks = useQuery({
    queryKey,
    queryFn: async () => {
      if (!brandId) return []
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_COLUMNS)
        .eq('brand_id', brandId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as Task[]
    },
    enabled: !!brandId,
    // Realtime channel handles live updates; 1 minute cache stops route
    // bounces (Tasks → Calendar → Tasks) from refetching the board.
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!brandId) return
    const channel = supabase
      .channel(`tasks:${brandId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `brand_id=eq.${brandId}` },
        () => queryClient.invalidateQueries({ queryKey }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [brandId]) // eslint-disable-line react-hooks/exhaustive-deps

  const createTask = useMutation({
    mutationFn: async (payload: TaskInsert) => {
      // Place the new card at the tail of its column so it doesn't leapfrog
      // backfilled rows (whose sort_order starts at 1024 and climbs).
      const existing = queryClient.getQueryData<Task[]>(queryKey) ?? []
      const maxOrder = existing
        .filter((t) => t.status === payload.status)
        .reduce((m, t) => (t.sort_order > m ? t.sort_order : m), 0)
      const nextOrder = maxOrder + 1024
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...payload, sort_order: nextOrder } as unknown as TaskInsert)
        .select()
        .single()
      if (error) throw error
      return data as Task
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const updateTask = useMutation<Task, Error, { id: string; patch: TaskUpdate }>({
    mutationFn: async ({ id, patch }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Task
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Task[]>(queryKey)
      queryClient.setQueryData<Task[]>(queryKey,
        (old) => old?.map((t) => t.id === id ? { ...t, ...patch } : t) ?? [])
      return { previous }
    },
    onError: (_err: unknown, _vars: unknown, ctx: unknown) => {
      const c = ctx as { previous: Task[] | undefined } | undefined
      if (c?.previous) queryClient.setQueryData(queryKey, c.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  // Drag-reorder: compute a fractional sort_order (midpoint between the two
  // neighbors at the drop target, or half/double the edge when dropping at
  // one end) and patch the moved task. Status may also change if the drop
  // crossed columns.
  const reorderTask = useMutation<Task, Error, { id: string; sort_order: number; status?: Task['status'] }>({
    mutationFn: async ({ id, sort_order, status }) => {
      // Don't set updated_at — the tasks_updated_at trigger handles it.
      const patch: TaskUpdate = { sort_order }
      if (status) patch.status = status
      const { data, error } = await supabase
        .from('tasks')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Task
    },
    onMutate: async ({ id, sort_order, status }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Task[]>(queryKey)
      queryClient.setQueryData<Task[]>(queryKey, (old) => {
        if (!old) return old
        return old
          .map((t) => (t.id === id ? { ...t, sort_order, status: status ?? t.status } : t))
          .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
      })
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      const c = ctx as { previous: Task[] | undefined } | undefined
      if (c?.previous) queryClient.setQueryData(queryKey, c.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  return { tasks, createTask, updateTask, deleteTask, reorderTask }
}

