import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Check, X as XIcon, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

type ApprovalEntry = {
  id: string
  platform: string
  title: string | null
  body: string | null
  // `script` is the new home for the post brief; `body` is the legacy
  // column kept for back-compat with old approval tokens.
  script?: string | null
  scheduled_date: string
  status: string
  approval_status: string | null
  approval_note: string | null
}

// ─── Approval Card ────────────────────────────────────────────────────────────

function ApprovalCard({
  entry,
  token,
  index,
  onUpdate,
}: {
  entry: ApprovalEntry
  token: string
  index: number
  onUpdate: (id: string, status: 'approved' | 'rejected') => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localStatus, setLocalStatus] = useState(entry.approval_status)

  async function submit(action: 'approved' | 'rejected') {
    setSubmitting(true)
    try {
      const res = await fetch(`${FUNCTIONS_URL}/submit-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, entry_id: entry.id, action, note: note || undefined }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error ?? json?.message ?? `Server returned ${res.status}`)
      }
      setLocalStatus(action)
      onUpdate(entry.id, action)
      toast.success(action === 'approved' ? 'Approved' : 'Changes requested')
    } catch (err) {
      toast.error('Could not submit', {
        description: err instanceof Error ? err.message : 'Network error — please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Prefer script (new column); fall back to body for legacy entries.
  const bodyText = entry.script ?? entry.body ?? ''
  const isLong = bodyText.length > 200

  return (
    <article
      className="premium-card overflow-hidden rounded-2xl ring-1 ring-border/80 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'backwards' }}
    >
      <header className="relative px-5 py-3.5 flex items-center gap-2 border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 mr-1 tabular-nums"
        >
          № {String(index + 1).padStart(2, '0')}
        </span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-foreground/[0.06] text-foreground capitalize ring-1 ring-foreground/[0.08]">
          {entry.platform}
        </span>
        <span className="text-xs text-muted-foreground">
          {format(parseISO(entry.scheduled_date), 'MMM d, yyyy')}
        </span>
        {localStatus && (
          <span
            className={`ml-auto inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-200 ${
              localStatus === 'approved'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20'
                : localStatus === 'rejected'
                ? 'bg-red-500/10 text-red-700 dark:text-red-400 ring-1 ring-red-500/20'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20'
            }`}
          >
            {localStatus === 'approved' && <Check className="h-3 w-3" />}
            {localStatus === 'rejected' && <XIcon className="h-3 w-3" />}
            {localStatus === 'pending_review'
              ? 'Pending'
              : localStatus.charAt(0).toUpperCase() + localStatus.slice(1)}
          </span>
        )}
      </header>

      <div className="px-5 py-5 space-y-3">
        {entry.title && (
          <h3
            className="text-foreground"
            style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 500, lineHeight: 1.25, letterSpacing: '-0.02em' }}
          >
            {entry.title}
          </h3>
        )}
        {bodyText && (
          <div>
            <p
              className={`text-[13.5px] text-muted-foreground leading-[1.65] whitespace-pre-wrap ${!expanded && isLong ? 'line-clamp-4' : ''}`}
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              {bodyText}
            </p>
            {isLong && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-foreground/80 mt-1.5 hover:text-foreground underline underline-offset-2 transition-colors"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        {!localStatus && (
          <div className="pt-2">
            {showReject ? (
              <div className="space-y-2">
                <label htmlFor={`reject-note-${entry.id}`} className="sr-only">
                  Optional note for the team
                </label>
                <textarea
                  id={`reject-note-${entry.id}`}
                  name="rejection_note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note for the team — what should change?"
                  rows={3}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-card resize-none placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => submit('rejected')}
                    disabled={submitting}
                    className="flex-1 rounded-lg bg-gradient-to-b from-red-500 to-red-600 text-white text-sm font-medium py-2 hover:brightness-110 active:brightness-95 disabled:opacity-60 transition-all duration-150 shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_1px_2px_-1px_rgba(0,0,0,0.3)]"
                  >
                    {submitting ? 'Sending…' : 'Submit feedback'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReject(false)}
                    className="rounded-lg border border-border text-sm font-medium px-4 py-2 hover:bg-accent hover:-translate-y-px active:translate-y-0 transition-all duration-150"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => submit('approved')}
                  disabled={submitting}
                  className="group flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 text-white text-sm font-medium py-2 hover:brightness-110 active:brightness-95 disabled:opacity-60 transition-all duration-150 shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_1px_2px_-1px_rgba(0,0,0,0.3)] hover:-translate-y-px active:translate-y-0"
                >
                  <Check className="h-3.5 w-3.5 transition-transform duration-150 group-hover:scale-110" aria-hidden />
                  {submitting ? 'Saving…' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReject(true)}
                  className="flex-1 rounded-lg border border-border bg-card text-sm font-medium py-2 hover:bg-accent hover:-translate-y-px active:translate-y-0 transition-all duration-150"
                >
                  Request changes
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center max-w-sm space-y-2">
        <div className="eyebrow mb-2">Approval link</div>
        <h1
          style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 500, letterSpacing: '-0.025em' }}
        >
          Link unavailable
        </h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

export default function PublicApprovalPage() {
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()

  const tokenValid = !!token && UUID_RE.test(token)

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-approval', token],
    queryFn: async () => {
      const res = await fetch(`${FUNCTIONS_URL}/submit-approval?token=${encodeURIComponent(token!)}`)
      const isJson = res.headers.get('content-type')?.includes('application/json') ?? false
      const json = isJson ? await res.json().catch(() => ({})) : {}
      if (!res.ok) {
        throw new Error(
          (json as { error?: string; message?: string })?.error
            ?? (json as { error?: string; message?: string })?.message
            ?? `Server returned ${res.status}`,
        )
      }
      if (!isJson) throw new Error('Unexpected response from server')
      return json as {
        brand: { name: string; niche: string; color: string }
        entries: ApprovalEntry[]
      }
    },
    enabled: tokenValid,
    // Refetch on focus so a reviewer who leaves the tab open sees fresh
    // entries when the team publishes more content for review.
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  if (!tokenValid) {
    return <ErrorScreen message="This approval link is invalid or has expired." />
  }

  function handleUpdate(id: string, status: 'approved' | 'rejected') {
    queryClient.setQueryData(['public-approval', token], (old: typeof data) => {
      if (!old) return old
      return {
        ...old,
        entries: old.entries.map((e) =>
          e.id === id ? { ...e, approval_status: status } : e
        ),
      }
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div role="status" aria-live="polite" className="text-center space-y-2">
          <div className="h-8 w-8 border-2 border-foreground border-t-transparent rounded-full animate-spin mx-auto" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return <ErrorScreen message="This approval link is invalid or has expired." />
  }

  const { brand, entries } = data
  const pending = entries.filter((e) => !e.approval_status)
  const approved = entries.filter((e) => e.approval_status === 'approved').length
  const rejected = entries.filter((e) => e.approval_status === 'rejected').length
  const allActioned = entries.length > 0 && pending.length === 0
  const accent = brand.color || '#6366f1'

  return (
    <div className="min-h-screen bg-background">
      {/* Editorial hero — brand color as a soft wash, not a stripe. */}
      <header
        className="relative overflow-hidden border-b border-border/70"
        style={{
          background: `linear-gradient(180deg, color-mix(in oklch, ${accent} 10%, var(--background)) 0%, var(--background) 75%)`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, color-mix(in oklch, ${accent} 14%, transparent) 1px, transparent 1px),
              linear-gradient(to bottom, color-mix(in oklch, ${accent} 14%, transparent) 1px, transparent 1px)
            `,
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 20%, transparent 75%)',
          }}
        />
        <div className="relative max-w-2xl mx-auto px-6 pt-10 pb-8">
          <div className="flex items-center justify-between mb-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-500">
            <div className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 rounded-full ring-2 ring-background shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
                style={{ backgroundColor: accent }}
                aria-hidden
              />
              <span
                className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground"
              >
                Content Review
              </span>
            </div>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground/70">
              Vol. {format(new Date(), 'yy')} · {format(new Date(), 'MMM yy')}
            </span>
          </div>

          <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-700" style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}>
            <h1
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(40px, 7vw, 56px)',
                fontWeight: 400,
                lineHeight: 1.02,
                letterSpacing: '-0.025em',
              }}
            >
              {brand.name}
            </h1>
            <p className="text-[14px] text-muted-foreground mt-2 leading-relaxed">
              {allActioned
                ? 'All entries have been reviewed. Thank you.'
                : (
                  <>
                    <span className="font-medium text-foreground">{pending.length}</span>{' '}
                    {pending.length === 1 ? 'item' : 'items'} pending your review.
                  </>
                )}
            </p>
          </div>

          {entries.length > 0 && (
            <div
              className="mt-6 flex items-center gap-4 text-[12px] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500"
              style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}
            >
              <Stat label="Total" value={entries.length} />
              <span className="text-border">·</span>
              <Stat label="Approved" value={approved} tone="emerald" />
              <Stat label="Changes" value={rejected} tone="red" />
              <Stat label="Pending" value={pending.length} tone="amber" />
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        {allActioned ? (
          <div
            className="premium-card flex flex-col items-center justify-center py-14 text-center rounded-2xl ring-1 ring-border/80 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-500"
          >
            <div
              className="h-14 w-14 rounded-full flex items-center justify-center mb-4 ring-1 ring-emerald-500/20"
              style={{ background: 'color-mix(in oklch, oklch(0.72 0.16 145) 12%, var(--card))' }}
            >
              <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2
              style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}
            >
              All done.
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">
              Thank you for reviewing. The team has been notified of your decisions.
            </p>
          </div>
        ) : (
          entries.map((entry, i) => (
            <ApprovalCard
              key={entry.id}
              entry={entry}
              token={token!}
              index={i}
              onUpdate={handleUpdate}
            />
          ))
        )}
      </main>

      <footer className="max-w-2xl mx-auto px-6 pb-10 pt-2">
        <div className="border-t border-border/60 pt-5 flex items-center justify-center gap-1.5">
          <Sparkles className="h-3 w-3 text-muted-foreground/60" aria-hidden />
          <p className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70">
            Powered by Zek Studio
          </p>
        </div>
      </footer>
    </div>
  )
}

function Stat({
  label, value, tone,
}: { label: string; value: number; tone?: 'emerald' | 'red' | 'amber' }) {
  const toneClass =
    tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' :
    tone === 'red'     ? 'text-red-600 dark:text-red-400' :
    tone === 'amber'   ? 'text-amber-600 dark:text-amber-400' :
                         'text-foreground'
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={`mono-num font-semibold tabular-nums ${toneClass}`}>{value}</span>
      <span className="text-muted-foreground/70">{label}</span>
    </span>
  )
}
