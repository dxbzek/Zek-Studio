import { Circle, Loader2, Clock, CheckCircle2, FileText, Camera, CheckCheck, LifeBuoy, MoreHorizontal } from 'lucide-react'
import { differenceInHours, format, isPast, parseISO } from 'date-fns'
import type { TaskPriority, TaskStatus, TaskType } from '@/types'

export const COLUMNS: {
  id: TaskStatus
  label: string
  icon: typeof Circle
  empty: string
}[] = [
  { id: 'todo',        label: 'To Do',       icon: Circle,       empty: 'Nothing queued' },
  { id: 'in_progress', label: 'In Progress', icon: Loader2,      empty: 'Pick something up →' },
  { id: 'scheduled',   label: 'Scheduled',   icon: Clock,        empty: 'Drop here to schedule' },
  { id: 'done',        label: 'Done',        icon: CheckCircle2, empty: 'Nothing shipped yet.' },
]

export const TASK_TYPES: { value: TaskType; label: string; icon: typeof Circle }[] = [
  { value: 'content',  label: 'Content',           icon: FileText },
  { value: 'shoot',    label: 'Photo/Video Shoot', icon: Camera },
  { value: 'approval', label: 'Approval',          icon: CheckCheck },
  { value: 'backup',   label: 'Backup Plan',       icon: LifeBuoy },
  { value: 'other',    label: 'Other',             icon: MoreHorizontal },
]

export const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
]

export function dueMeta(due: string | null): { label: string; tone: string } | null {
  if (!due) return null
  try {
    const d = parseISO(due)
    const hours = differenceInHours(d, new Date())
    const label = format(d, 'MMM d')
    if (isPast(d) && hours < 0) return { label, tone: 'text-red-600 dark:text-red-400' }
    if (hours <= 48) return { label, tone: 'text-amber-600 dark:text-amber-400' }
    return { label, tone: 'text-muted-foreground' }
  } catch {
    return null
  }
}

export function assigneeInitial(email: string): string {
  return (email.split('@')[0][0] ?? '?').toUpperCase()
}
