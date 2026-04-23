import { useState, useMemo } from 'react'
import { UserPlus, Trash2, X, Plus, Check, ChevronDown } from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BrandAvatar } from '@/components/brand/BrandAvatar'
import { useAllTeam } from '@/hooks/useTeam'
import { useBrands } from '@/hooks/useBrands'
import { TEAM_ROLES } from '@/types'
import type { TeamMember, TeamRole, BrandProfile } from '@/types'
import { cn } from '@/lib/utils'

const ROLE_STYLES: Record<TeamRole, { label: string; cls: string }> = {
  admin:    { label: 'Admin',    cls: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  editor:   { label: 'Editor',   cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  approver: { label: 'Approver', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  viewer:   { label: 'Viewer',   cls: 'bg-muted text-muted-foreground' },
}

function initials(email: string) {
  return email.slice(0, 2).toUpperCase()
}

interface Person {
  email: string
  access: { brand: BrandProfile; member: TeamMember }[]
  anyAccepted: boolean
  earliestInvite: string
}

/** Group all team_members rows by normalized email, joined with brand info. */
function groupPeople(members: TeamMember[], brands: BrandProfile[]): Person[] {
  const brandById = new Map(brands.map((b) => [b.id, b]))
  const byEmail = new Map<string, Person>()
  for (const m of members) {
    const brand = brandById.get(m.brand_id)
    if (!brand) continue
    const email = m.email.toLowerCase()
    let p = byEmail.get(email)
    if (!p) {
      p = { email, access: [], anyAccepted: false, earliestInvite: m.invited_at }
      byEmail.set(email, p)
    }
    p.access.push({ brand, member: m })
    if (m.accepted_at) p.anyAccepted = true
    if (m.invited_at < p.earliestInvite) p.earliestInvite = m.invited_at
  }
  return Array.from(byEmail.values()).sort((a, b) =>
    a.earliestInvite.localeCompare(b.earliestInvite),
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function PersonRow({
  person,
  availableBrands,
  onRevoke,
  onGrant,
  onRemoveAll,
  onChangeRole,
  busy,
}: {
  person: Person
  availableBrands: BrandProfile[]
  onRevoke: (member: TeamMember) => void
  onGrant: (brandId: string) => void
  onRemoveAll: () => void
  onChangeRole: (member: TeamMember, role: TeamRole) => void
  busy: boolean
}) {
  const hasAccess = new Set(person.access.map((a) => a.brand.id))
  const grantable = availableBrands.filter((b) => !hasAccess.has(b.id))

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-border bg-card">
      <div className="h-[34px] w-[34px] rounded-full bg-muted text-foreground flex items-center justify-center text-[11px] font-semibold shrink-0">
        {initials(person.email)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-medium text-foreground truncate">{person.email}</p>
          {person.anyAccepted ? (
            <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
              Active
            </span>
          ) : (
            <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              Pending
            </span>
          )}
        </div>

        {/* Brand access chips */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {person.access.map(({ brand, member }) => (
            <BrandChip
              key={member.id}
              brand={brand}
              role={member.role}
              onRemove={() => onRevoke(member)}
              onChangeRole={(r) => onChangeRole(member, r)}
              disabled={busy}
            />
          ))}
          {grantable.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={busy}
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-dashed border-border',
                    'text-muted-foreground hover:text-foreground hover:border-foreground transition-colors',
                    busy && 'opacity-50 cursor-not-allowed',
                  )}
                  title="Grant access to another brand"
                >
                  <Plus className="h-3 w-3" />
                  Add brand
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {grantable.map((brand) => (
                  <DropdownMenuItem
                    key={brand.id}
                    className="gap-2"
                    onClick={() => onGrant(brand.id)}
                  >
                    <BrandAvatar brand={brand} size={20} rounded="full" />
                    <span className="truncate">{brand.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Remove-everywhere button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
        onClick={onRemoveAll}
        disabled={busy}
        title="Remove from all brands"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function BrandChip({
  brand,
  role,
  onRemove,
  onChangeRole,
  disabled,
}: {
  brand: BrandProfile
  role: TeamRole
  onRemove: () => void
  onChangeRole: (r: TeamRole) => void
  disabled: boolean
}) {
  const roleStyle = ROLE_STYLES[role] ?? ROLE_STYLES.editor
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] pl-1 pr-1 py-0.5 rounded-full border border-border bg-background">
      <BrandAvatar brand={brand} size={18} rounded="full" />
      <span className="truncate max-w-[140px]">{brand.name}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            title="Change role"
            className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium',
              roleStyle.cls,
              'hover:brightness-110 transition',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {roleStyle.label}
            <ChevronDown className="h-2.5 w-2.5 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-[11px] text-muted-foreground">
            Role on {brand.name}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {TEAM_ROLES.map((r) => (
            <DropdownMenuItem
              key={r.value}
              onClick={() => onChangeRole(r.value)}
              className="flex items-start gap-2"
            >
              <div className="w-3 pt-1">
                {r.value === role && <Check className="h-3 w-3 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium">{r.label}</div>
                <div className="text-[10.5px] text-muted-foreground leading-tight">{r.desc}</div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className={cn(
          'h-4 w-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        title="Revoke access"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  )
}

// ─── Invite dialog ────────────────────────────────────────────────────────────

function InviteDialog({
  open,
  onOpenChange,
  brands,
  onSubmit,
  submitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  brands: BrandProfile[]
  onSubmit: (email: string, brandIds: string[], role: TeamRole) => Promise<void>
  submitting: boolean
}) {
  const [email, setEmail] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [role, setRole] = useState<TeamRole>('editor')

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) { toast.error('Enter a valid email'); return }
    if (picked.size === 0) { toast.error('Pick at least one brand'); return }
    await onSubmit(trimmed, Array.from(picked), role)
    setEmail('')
    setPicked(new Set())
    setRole('editor')
  }

  // When the dialog closes via Cancel or outside-click, clear state too.
  function handleOpenChange(next: boolean) {
    if (!next) { setEmail(''); setPicked(new Set()); setRole('editor') }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Specialist</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            They'll receive a sign-up email and will see the brand(s) you pick as soon as their account is active.
          </p>
          <Input
            type="email"
            placeholder="specialist@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <div className="space-y-1.5">
            <label className="text-[12px] text-muted-foreground">Grant access to</label>
            <div className="flex flex-wrap gap-1.5">
              {brands.map((b) => {
                const on = picked.has(b.id)
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => togglePick(b.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 text-[12px] pl-1 pr-2 py-0.5 rounded-full border transition-colors',
                      on
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <BrandAvatar brand={b} size={18} rounded="full" />
                    <span className="truncate max-w-[140px]">{b.name}</span>
                    {on && <Check className="h-3 w-3 text-primary" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] text-muted-foreground">Role on picked brand(s)</label>
            <div className="grid grid-cols-2 gap-1.5">
              {TEAM_ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={cn(
                    'text-left rounded-lg border px-2.5 py-2 transition-colors',
                    role === r.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full', ROLE_STYLES[r.value].cls)}>
                      {r.label}
                    </span>
                    {role === r.value && <Check className="h-3 w-3 text-primary" />}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground mt-1 leading-tight">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={submitting}>
            {submitting ? 'Sending…' : `Invite to ${picked.size || 0} brand${picked.size === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { brands } = useBrands()
  const { members, grantAccess, revokeAccess, updateRole } = useAllTeam()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<Person | null>(null)
  const [working, setWorking] = useState(false)

  const people = useMemo(
    () => groupPeople(members.data ?? [], brands),
    [members.data, brands],
  )

  const stats = {
    people: people.length,
    seats: (members.data ?? []).length,
    brands: brands.length,
    pending: people.filter((p) => !p.anyAccepted).length,
  }

  async function handleInvite(email: string, brandIds: string[], role: TeamRole) {
    setWorking(true)
    try {
      const results = await Promise.allSettled(
        brandIds.map((brandId) => grantAccess.mutateAsync({ email, brandId, role })),
      )
      const ok = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (failed.length > 0) {
        toast.error(`Granted ${ok} of ${brandIds.length}`, {
          description: failed.map((f) => (f.reason as Error).message).join(' · '),
        })
      } else {
        // Check if any of the successful results was an existing account
        // needing a share link — copy the first one we see.
        const resolved = results
          .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof grantAccess.mutateAsync>>> => r.status === 'fulfilled')
          .map((r) => r.value)
        const link = resolved.find((r) => r?.actionLink)?.actionLink
        if (link) {
          await navigator.clipboard.writeText(link).catch(() => {})
          toast.success(`${email} added to ${ok} brand${ok === 1 ? '' : 's'}`, {
            description: 'Sign-in link copied to clipboard (Supabase won\'t re-email existing users).',
            duration: 10000,
          })
        } else {
          toast.success(`${email} invited to ${ok} brand${ok === 1 ? '' : 's'}`)
        }
      }
      setInviteOpen(false)
    } catch (err) {
      toast.error('Failed to invite', { description: (err as Error).message })
    } finally {
      setWorking(false)
    }
  }

  async function handleRevoke(member: TeamMember) {
    setWorking(true)
    try {
      await revokeAccess.mutateAsync(member.id)
      toast.success(`Revoked access for ${member.email}`)
    } catch (err) {
      toast.error('Failed to revoke', { description: (err as Error).message })
    } finally {
      setWorking(false)
    }
  }

  async function handleGrant(email: string, brandId: string) {
    setWorking(true)
    try {
      await grantAccess.mutateAsync({ email, brandId, role: 'editor' })
      toast.success(`Added ${email} to brand (Editor)`)
    } catch (err) {
      toast.error('Failed to grant access', { description: (err as Error).message })
    } finally {
      setWorking(false)
    }
  }

  async function handleChangeRole(member: TeamMember, role: TeamRole) {
    if (member.role === role) return
    setWorking(true)
    try {
      await updateRole.mutateAsync({ memberId: member.id, role })
      toast.success(`Role changed to ${ROLE_STYLES[role].label}`)
    } catch (err) {
      toast.error('Failed to change role', { description: (err as Error).message })
    } finally {
      setWorking(false)
    }
  }

  async function handleRemoveAll(person: Person) {
    setWorking(true)
    try {
      await Promise.all(person.access.map(({ member }) => revokeAccess.mutateAsync(member.id)))
      toast.success(`${person.email} removed from all brands`)
      setConfirmRemove(null)
    } catch (err) {
      toast.error('Failed to remove', { description: (err as Error).message })
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="eyebrow mb-1.5">Collaborate</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.025em' }}>
            Team
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Everyone across your {stats.brands} brand{stats.brands === 1 ? '' : 's'}.
          </p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)} disabled={brands.length === 0}>
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
          Invite
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {brands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">Create a brand first before inviting specialists.</p>
          </div>
        ) : members.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading team…</p>
        ) : people.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <UserPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No team members yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Invite specialists and pick which brand(s) they can access.
            </p>
            <Button size="sm" className="mt-4" onClick={() => setInviteOpen(true)}>
              Invite your first specialist
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl">
            {/* Stat row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'People', value: String(stats.people) },
                { label: 'Seats', value: String(stats.seats) },
                { label: 'Brands', value: String(stats.brands) },
                { label: 'Pending', value: String(stats.pending) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-3">
                  <div className="eyebrow mb-1" style={{ fontSize: 9.5 }}>{label}</div>
                  <div className="mono-num" style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 400, lineHeight: 1 }}>{value}</div>
                </div>
              ))}
            </div>
            {people.map((person) => (
              <PersonRow
                key={person.email}
                person={person}
                availableBrands={brands}
                onRevoke={handleRevoke}
                onGrant={(brandId) => handleGrant(person.email, brandId)}
                onRemoveAll={() => setConfirmRemove(person)}
                onChangeRole={handleChangeRole}
                busy={working}
              />
            ))}
          </div>
        )}
      </div>

      {/* Invite Dialog */}
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        brands={brands}
        onSubmit={handleInvite}
        submitting={working}
      />

      {/* Confirm remove-all dialog */}
      <Dialog open={!!confirmRemove} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove from all brands?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            <strong>{confirmRemove?.email}</strong> will lose access to all{' '}
            {confirmRemove?.access.length} brand{confirmRemove?.access.length === 1 ? '' : 's'} they're on.
            Their tasks will remain but become unassigned.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => confirmRemove && handleRemoveAll(confirmRemove)}
              disabled={working}
            >
              {working ? 'Removing…' : 'Remove everywhere'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
