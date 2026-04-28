import type { ApprovalStatus, CalendarStatus, ContentFormat, TaskPriority, TaskStatus, TaskType } from '@/types'

// Unified status palette. "Scheduled" uses the same amber across Calendar and
// Tasks so the concept reads the same on either surface. Todo maps to the
// draft-zinc; in_progress uses indigo to distinguish it from amber "scheduled"
// without colliding with the approval palette. Done = emerald = published.

export const CALENDAR_STATUS_CHIP: Record<CalendarStatus, string> = {
  draft:     'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  scheduled: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

export const CALENDAR_STATUS_BORDER: Record<CalendarStatus, string> = {
  draft:     'border-l-zinc-400',
  scheduled: 'border-l-amber-400',
  published: 'border-l-emerald-500',
}

export const CALENDAR_STATUS_DOT: Record<CalendarStatus, string> = {
  draft:     'bg-zinc-400',
  scheduled: 'bg-amber-400',
  published: 'bg-emerald-500',
}

// Content-format palette. Reel=purple, Carousel=blue, Static=emerald,
// Emergency Backup=red. Tints are deliberately faint (5%) so they layer
// under existing status borders without competing with them on the grid.
export const CONTENT_FORMAT_CHIP: Record<ContentFormat, string> = {
  reel:             'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  carousel:         'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  static:           'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  emergency_backup: 'bg-red-500/10 text-red-700 dark:text-red-300',
}

export const CONTENT_FORMAT_TINT: Record<ContentFormat, string> = {
  reel:             'bg-purple-500/[0.06]',
  carousel:         'bg-blue-500/[0.06]',
  static:           'bg-emerald-500/[0.06]',
  emergency_backup: 'bg-red-500/[0.08]',
}

export const CONTENT_FORMAT_SOLID: Record<ContentFormat, string> = {
  reel:             'bg-purple-500 text-white border-purple-500',
  carousel:         'bg-blue-500 text-white border-blue-500',
  static:           'bg-emerald-500 text-white border-emerald-500',
  emergency_backup: 'bg-red-500 text-white border-red-500',
}

export const TASK_STATUS_CHIP: Record<TaskStatus, string> = {
  todo:        'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  in_progress: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  scheduled:   'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  done:        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

export const TASK_STATUS_BORDER: Record<TaskStatus, string> = {
  todo:        'border-l-zinc-400',
  in_progress: 'border-l-indigo-400',
  scheduled:   'border-l-amber-400',
  done:        'border-l-emerald-500',
}

export const TASK_STATUS_DOT: Record<TaskStatus, string> = {
  todo:        'bg-zinc-400',
  in_progress: 'bg-indigo-400',
  scheduled:   'bg-amber-400',
  done:        'bg-emerald-500',
}

// Column-level tokens for the Task Board (faint column fill + top accent +
// icon color). Kept separate from the chip/dot palette so we can tune
// column density independently of the card.
export const TASK_STATUS_COLUMN_TINT: Record<TaskStatus, string> = {
  todo:        'bg-zinc-500/[0.04]',
  in_progress: 'bg-indigo-500/[0.05]',
  scheduled:   'bg-amber-500/[0.05]',
  done:        'bg-emerald-500/[0.05]',
}

export const TASK_STATUS_ACCENT: Record<TaskStatus, string> = {
  todo:        'border-t-zinc-400/60',
  in_progress: 'border-t-indigo-400/70',
  scheduled:   'border-t-amber-400/80',
  done:        'border-t-emerald-500/80',
}

export const TASK_STATUS_ICON_COLOR: Record<TaskStatus, string> = {
  todo:        'text-zinc-500 dark:text-zinc-400',
  in_progress: 'text-indigo-500 dark:text-indigo-400',
  scheduled:   'text-amber-500 dark:text-amber-400',
  done:        'text-emerald-600 dark:text-emerald-400',
}

// Approval palette (Calendar client-approval chips, dots, solid buttons).
// Pending = amber, Approved = emerald, Rejected = red — kept distinct from the
// scheduled/published palette since "approved" is not "published".
export const APPROVAL_STATUS_CHIP: Record<ApprovalStatus, string> = {
  pending_review: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  approved:       'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  rejected:       'bg-red-500/10 text-red-600 dark:text-red-400',
}

export const APPROVAL_STATUS_SOLID: Record<ApprovalStatus, string> = {
  pending_review: 'bg-amber-500 text-white border-amber-500',
  approved:       'bg-emerald-500 text-white border-emerald-500',
  rejected:       'bg-red-500 text-white border-red-500',
}

export const APPROVAL_STATUS_DOT: Record<ApprovalStatus, string> = {
  pending_review: 'bg-amber-400',
  approved:       'bg-emerald-500',
  rejected:       'bg-red-500',
}

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending_review: 'Pending Review',
  approved:       'Approved',
  rejected:       'Rejected',
}

// Task type palette (chips on task cards + quick-add type picker).
export const TASK_TYPE_CHIP: Record<TaskType, string> = {
  content:  'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  shoot:    'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  approval: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  backup:   'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  other:    'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
}

// Task priority palette (dot on card + chip on priority picker).
export const TASK_PRIORITY_DOT: Record<TaskPriority, string> = {
  low:    'bg-zinc-400',
  medium: 'bg-amber-400',
  high:   'bg-rose-500',
}

export const TASK_PRIORITY_CHIP: Record<TaskPriority, string> = {
  low:    'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  high:   'bg-rose-500/10 text-rose-600 dark:text-rose-400',
}

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low:    'Low priority',
  medium: 'Medium priority',
  high:   'High priority',
}
