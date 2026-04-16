import { useState } from 'react'
import { UserPlus, Trash2, Clock, CheckCircle } from 'lucide-react'
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
import { useActiveBrand } from '@/stores/activeBrand'
import { useTeam } from '@/hooks/useTeam'
import { useTasks } from '@/hooks/useTasks'
import type { TeamMember } from '@/types'

function initials(email: string) {
  return email.slice(0, 2).toUpperCase()
}

function MemberRow({
  member,
  taskCount,
  onRemove,
}: {
  member: TeamMember
  taskCount: number
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
        {initials(member.email)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{member.email}</p>
        <p className="text-xs text-muted-foreground">
          {taskCount} task{taskCount !== 1 ? 's' : ''} assigned
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {member.accepted_at ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="h-3.5 w-3.5" />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <Clock className="h-3.5 w-3.5" />
            Pending
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
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

  if (!activeBrand) {
    return (
      <div className="p-6 text-muted-foreground">
        Select a brand to manage your team.
      </div>
    )
  }

  function taskCountFor(member: TeamMember) {
    return (tasks.data ?? []).filter((t) => t.assignee_email === member.email).length
  }

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{activeBrand.name}</p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1.5" />
          Invite Specialist
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {members.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading team...</p>
        ) : (members.data ?? []).length === 0 ? (
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
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs text-muted-foreground mb-3">
              {(members.data ?? []).length} specialist{(members.data ?? []).length !== 1 ? 's' : ''} on this brand
            </p>
            {(members.data ?? []).map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                taskCount={taskCountFor(member)}
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
