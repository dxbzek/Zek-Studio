import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Task, TaskInsert, TaskUpdate } from '@/types'

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
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Task[]
    },
    enabled: !!brandId,
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
      const { data, error } = await supabase
        .from('tasks')
        .insert(payload)
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

  return { tasks, createTask, updateTask, deleteTask }
}

/** Specialist: only tasks assigned to the current user */
export function useMyTasks() {
  const queryClient = useQueryClient()
  const queryKey = ['my-tasks'] as const

  const tasks = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const [byId, byEmail] = await Promise.all([
        supabase.from('tasks').select('*').eq('assignee_id', user.id),
        user.email
          ? supabase.from('tasks').select('*').eq('assignee_email', user.email.toLowerCase()).is('assignee_id', null)
          : Promise.resolve({ data: [] }),
      ])
      const combined = [...(byId.data ?? []), ...((byEmail as any).data ?? [])]
      combined.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '') || 1)
      return combined as Task[]
    },
  })

  useEffect(() => {
    const channel = supabase
      .channel('my-tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' },
        () => queryClient.invalidateQueries({ queryKey }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  return { tasks, updateTask }
}
