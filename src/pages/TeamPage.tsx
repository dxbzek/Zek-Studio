import { useState, useMemo } from 'react'
import { UserPlus, Trash2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { NoBrandSelected } from '@/components/layout/NoBrandSelected'
import { useActiveBrand } from '@/stores/activeBrand'
import { useTeam } from '@/hooks/useTeam'
import { useTasks } from '@/hooks/useTasks'
import type { TeamMember, Task } from '@/types'

function initials(email: string) {
  return email.slice(0, 2).toUpperCase()
}

interface MemberWorkload {
  total: number
  done: number
  inProgress: number
  todo: number
  overdue: number
}

function computeWorkload(memberEmail: string, tasks: Task[]): MemberWorkload {
  const today = new Date().toISOString().slice(0, 10)
  const memberTasks = tasks.filter((t) => t.assignee_email === memberEmail)
  return {
    total:      memberTasks.length,
    done:       memberTasks.filter((t) => t.status === 'done').length,
    inProgress: memberTasks.filter((t) => t.status === 'in_progress').length,
    todo:       memberTasks.filter((t) => t.status === 'todo').length,
    overdue:    memberTasks.filter((t) => t.status !== 'done' && t.due_date && t.due_date < today).length,
  }
}

function WorkloadBar({ workload }: { workload: MemberWorkload }) {
  if (workload.total === 0) return null
  const completionPct = Math.round((workload.done / workload.total) * 100)
  const inProgressPct = Math.round((workload.inProgress / workload.total) * 100)
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-3 text-[11px]">
        <span className="text-muted-foreground">
          {workload.done}/{workload.total} done · {completionPct}%
        </span>
        {workload.inProgress > 0 && (
          <span className="text-blue-500 dark:text-blue-400">{workload.inProgress} in progress</span>
        )}
        {workload.overdue > 0 && (
          <span className="flex items-center gap-0.5 text-red-500">
            <AlertCircle className="h-3 w-3" />
            {workload.overdue} overdue
          </span>
        )}
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
        {workload.done > 0 && (
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${completionPct}%` }}
          />
        )}
        {workload.inProgress > 0 && (
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${inProgressPct}%` }}
          />
        )}
      </div>
    </div>
  )
}

function MemberRow({
  member,
  workload,
  onRemove,
}: {
  member: TeamMember
  workload: MemberWorkload
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card">
      <div className="h-[34px] w-[34px] rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0" style={{ background: '#D4C2A8', color: '#111' }}>
        {initials(member.email)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">{member.email}</p>
        <p className="text-[11px] text-muted-foreground">
          {workload.total} task{workload.total !== 1 ? 's' : ''} · {workload.done} done
        </p>
        <WorkloadBar workload={workload} />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {member.accepted_at ? (
          <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
            Active
          </span>
        ) : (
          <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            Pending
          </span>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export default function TeamPage() {
  const { activeBrand } = useActiveBrand()
  const { members, invite, removeMember } = useTeam(activeBrand?.id ?? null)
  const { tasks } = useTasks(activeBrand?.id ?? null)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null)

  const allTasks = tasks.data ?? []

  const teamStats = useMemo(() => {
    if (allTasks.length === 0) return { totalTasks: 0, totalDone: 0, totalOverdue: 0 }
    const today = new Date().toISOString().slice(0, 10)
    return {
      totalTasks:   allTasks.length,
      totalDone:    allTasks.filter((t) => t.status === 'done').length,
      totalOverdue: allTasks.filter((t) => t.status !== 'done' && t.due_date && t.due_date < today).length,
    }
  }, [allTasks])

  if (!activeBrand) return <NoBrandSelected />

  async function handleInvite() {
    const email = emailInput.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      toast.error('Enter a valid email address')
      return
    }
    try {
      await invite.mutateAsync(email)
      toast.success(`Invite sent to ${email}`)
      setEmailInput('')
      setInviteOpen(false)
    } catch (err) {
      toast.error('Failed to send invite', { description: (err as Error).message })
    }
  }

  async function handleRemove(member: TeamMember) {
    try {
      await removeMember.mutateAsync(member.id)
      toast.success(`${member.email} removed from team`)
      setConfirmRemove(null)
    } catch (err) {
      toast.error('Failed to remove member', { description: (err as Error).message })
    }
  }

  const memberList = members.data ?? []

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="eyebrow mb-1.5">Collaborate</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.025em' }}>
            Team
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">{activeBrand.name}</p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
          Invite
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {members.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading team...</p>
        ) : memberList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <UserPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No team members yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Invite your social media specialists. They'll get an email with a link to set up their account.
            </p>
            <Button size="sm" className="mt-4" onClick={() => setInviteOpen(true)}>
              Invite your first specialist
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {/* KPI stat row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Members', value: String(memberList.length) },
                { label: 'Total tasks', value: String(teamStats.totalTasks) },
                { label: 'Completed', value: String(teamStats.totalDone) },
                { label: 'Overdue', value: String(teamStats.totalOverdue) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-3">
                  <div className="eyebrow mb-1" style={{ fontSize: 9.5 }}>{label}</div>
                  <div className="mono-num" style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 400, lineHeight: 1 }}>{value}</div>
                </div>
              ))}
            </div>
            {memberList.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                workload={computeWorkload(member.email, allTasks)}
                onRemove={() => setConfirmRemove(member)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Specialist</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              The specialist will receive an email to set up their Zek Studio account. They'll see only their assigned tasks.
            </p>
            <Input
              type="email"
              placeholder="specialist@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInvite() }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleInvite} disabled={invite.isPending}>
              {invite.isPending ? 'Sending...' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Remove Dialog */}
      <Dialog open={!!confirmRemove} onOpenChange={() => setConfirmRemove(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove team member?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {confirmRemove?.email} will lose access to this brand's tasks. Their tasks will remain but become unassigned.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => confirmRemove && handleRemove(confirmRemove)}
              disabled={removeMember.isPending}
            >
              {removeMember.isPending ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
