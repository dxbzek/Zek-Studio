import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PlatformBadge } from '@/lib/platformBrand'
import { FormButtonGroup } from '@/components/ui/form-button-group'
import type { FormButtonGroupOption } from '@/components/ui/form-button-group'
import {
  TASK_PRIORITY_CHIP, TASK_STATUS_CHIP, TASK_TYPE_CHIP,
} from '@/lib/statusTokens'
import { errorMessage } from '@/lib/formatting'
import type {
  CalendarEntry, Task, TaskInsert, TaskPriority, TaskStatus, TaskType, TaskUpdate,
} from '@/types'
import { COLUMNS, PRIORITIES, TASK_TYPES } from './taskConstants'

interface TaskDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  task: Task | null
  defaultStatus: TaskStatus
  members: { id: string; user_id: string | null; email: string }[]
  linkedEntry?: CalendarEntry
  linkedEntryLoading: boolean
  isSpecialist: boolean
  brandId: string
  saving: boolean
  deleting: boolean
  onCreate: (payload: TaskInsert) => Promise<unknown>
  onUpdate: (id: string, patch: TaskUpdate) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}

export function TaskDrawer({
  open, onOpenChange, mode, task, defaultStatus, members, linkedEntry, linkedEntryLoading,
  isSpecialist, brandId, saving, deleting, onCreate, onUpdate, onDelete,
}: TaskDrawerProps) {
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formType, setFormType] = useState<TaskType>('content')
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium')
  const [formDue, setFormDue] = useState('')
  const [formAssigneeEmail, setFormAssigneeEmail] = useState('')
  const [formStatus, setFormStatus] = useState<TaskStatus>(defaultStatus)

  // Sync form state when the drawer opens with a different task / mode.
  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && task) {
      setFormTitle(task.title)
      setFormDesc(task.description ?? '')
      setFormType(task.type)
      setFormPriority(task.priority)
      setFormDue(task.due_date ?? '')
      setFormAssigneeEmail(task.assignee_email ?? '')
      setFormStatus(task.status)
    } else {
      setFormTitle('')
      setFormDesc('')
      setFormType('content')
      setFormPriority('medium')
      setFormDue('')
      setFormAssigneeEmail('')
      setFormStatus(defaultStatus)
    }
  }, [open, mode, task, defaultStatus])

  async function handleSave() {
    if (!formTitle.trim()) { toast.error('Title is required'); return }
    try {
      const assigneeId = formAssigneeEmail
        ? members.find((m) => m.email === formAssigneeEmail)?.user_id ?? null
        : null

      if (mode === 'create') {
        const payload: TaskInsert = {
          brand_id: brandId,
          title: formTitle.trim(),
          description: formDesc.trim() || null,
          type: formType,
          status: formStatus,
          priority: formPriority,
          assignee_id: assigneeId,
          assignee_email: formAssigneeEmail || null,
          calendar_entry_id: null,
          due_date: formDue || null,
          created_by: null,
        }
        await onCreate(payload)
        toast.success('Task created')
      } else if (task) {
        await onUpdate(task.id, {
          title: formTitle.trim(),
          description: formDesc.trim() || null,
          type: formType,
          status: formStatus,
          priority: formPriority,
          assignee_id: assigneeId,
          assignee_email: formAssigneeEmail || null,
          due_date: formDue || null,
        })
        toast.success('Task saved')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to save task', { description: errorMessage(err) })
    }
  }

  async function handleDelete() {
    if (!task) return
    try {
      await onDelete(task.id)
      toast.success('Task deleted')
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to delete', { description: errorMessage(err) })
    }
  }

  async function handleSpecialistStatus(status: TaskStatus, label: string) {
    if (!task || task.status === status) return
    try {
      await onUpdate(task.id, { status })
      toast.success(`Status: ${label}`)
    } catch (err) {
      toast.error('Update failed', { description: errorMessage(err) })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-md"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isSpecialist && formTitle.trim()) {
            e.preventDefault()
            handleSave()
          }
        }}
      >
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle>{mode === 'create' ? 'New Task' : 'Edit Task'}</SheetTitle>
          <SheetDescription className="sr-only">
            {mode === 'create' ? 'Create a new task for this brand.' : 'Edit this task’s details, status, priority, and assignment.'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Task title…"
              disabled={isSpecialist}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              rows={3}
              className="resize-none"
              placeholder="Additional details…"
              disabled={isSpecialist}
            />
          </div>
          {!isSpecialist && (
            <div className="space-y-1.5">
              <FormButtonGroup<TaskStatus>
                label="Status"
                value={formStatus}
                onChange={setFormStatus}
                options={COLUMNS.map<FormButtonGroupOption<TaskStatus>>((col) => ({
                  value: col.id,
                  label: col.label,
                  icon: col.icon,
                  activeClassName: TASK_STATUS_CHIP[col.id],
                }))}
              />
              {formStatus === 'scheduled' && (
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Scheduled tasks don't appear on the calendar.{' '}
                  <Link
                    to="/calendar"
                    className="underline underline-offset-2 hover:text-foreground"
                    onClick={() => onOpenChange(false)}
                  >
                    Add a calendar entry →
                  </Link>
                </p>
              )}
            </div>
          )}
          <FormButtonGroup<TaskType>
            label="Type"
            value={formType}
            onChange={setFormType}
            disabled={isSpecialist}
            options={TASK_TYPES.map<FormButtonGroupOption<TaskType>>((tt) => ({
              value: tt.value,
              label: tt.label,
              icon: tt.icon,
              activeClassName: TASK_TYPE_CHIP[tt.value],
            }))}
          />
          <FormButtonGroup<TaskPriority>
            label="Priority"
            value={formPriority}
            onChange={setFormPriority}
            disabled={isSpecialist}
            options={PRIORITIES.map<FormButtonGroupOption<TaskPriority>>((p) => ({
              value: p.value,
              label: p.label,
              activeClassName: TASK_PRIORITY_CHIP[p.value],
            }))}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Due date</label>
            <Input
              type="date"
              value={formDue}
              onChange={(e) => setFormDue(e.target.value)}
              disabled={isSpecialist}
            />
          </div>
          {!isSpecialist && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Assign to <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Select value={formAssigneeEmail || '__none__'} onValueChange={(v) => setFormAssigneeEmail(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.email}>{m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {/* Linked calendar entry — read-only context for specialists */}
          {isSpecialist && mode === 'edit' && task?.calendar_entry_id && (() => {
            if (linkedEntry) {
              return (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 flex items-center gap-2">
                  <PlatformBadge platform={linkedEntry.platform} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground leading-tight">Linked calendar entry</p>
                    <p className="text-xs text-foreground truncate">
                      {format(parseISO(linkedEntry.scheduled_date), 'MMM d')} · {linkedEntry.platform}
                    </p>
                  </div>
                  <Link
                    to="/calendar"
                    onClick={() => onOpenChange(false)}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0"
                  >
                    View →
                  </Link>
                </div>
              )
            }
            if (linkedEntryLoading) {
              return (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 flex items-center gap-2">
                  <div className="h-5 w-5 rounded bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
                    <div className="h-2.5 w-32 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              )
            }
            return (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground leading-tight">Linked calendar entry</p>
                <p className="text-xs text-muted-foreground">This entry is no longer available.</p>
              </div>
            )
          })()}
          {isSpecialist && mode === 'edit' && task && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Status</label>
              <div className="flex gap-1.5">
                {COLUMNS.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => handleSpecialistStatus(col.id, col.label)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      task.status === col.id
                        ? `${TASK_STATUS_CHIP[col.id]} border-transparent`
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <SheetFooter className="border-t border-border px-6 py-4 flex-row gap-2">
          {!isSpecialist && mode === 'edit' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              Delete
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="ml-auto">
            {isSpecialist ? 'Close' : 'Cancel'}
          </Button>
          {!isSpecialist && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!formTitle.trim() || saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
