import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
      const { data, error } = await (supabase as any)
        .from('tasks')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Task[]
    },
    enabled: !!brandId,
  })

  const createTask = useMutation({
    mutationFn: async (payload: TaskInsert) => {
      const { data, error } = await (supabase as any)
        .from('tasks')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as Task
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskUpdate }) => {
      const { data, error } = await (supabase as any)
        .from('tasks')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Task
    },
    onMutate: async ({ id, patch }: { id: string; patch: TaskUpdate }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Task[]>(queryKey)
      queryClient.setQueryData<Task[]>(queryKey,
        (old) => old?.map((t) => t.id === id ? { ...t, ...patch } : t) ?? [])
      return { previous }
    },
    onError: (_err: unknown, _vars: unknown, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
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
      const { data: { user } } = await (supabase as any).auth.getUser()
      if (!user) return []
      const { data, error } = await (supabase as any)
        .from('tasks')
        .select('*')
        .eq('assignee_id', user.id)
        .order('due_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return (data ?? []) as Task[]
    },
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskUpdate }) => {
      const { data, error } = await (supabase as any)
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
    onError: (_err: unknown, _vars: unknown, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  return { tasks, updateTask }
}
