import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

type ApprovalEntry = {
  id: string
  platform: string
  title: string | null
  body: string | null
  scheduled_date: string
  status: string
  approval_status: string | null
  approval_note: string | null
}

// ─── Approval Card ────────────────────────────────────────────────────────────

function ApprovalCard({
  entry,
  token,
  onUpdate,
}: {
  entry: ApprovalEntry
  token: string
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

  const bodyText = entry.body ?? ''
  const isLong = bodyText.length > 200

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border bg-muted/20">
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground capitalize">
          {entry.platform}
        </span>
        <span className="text-xs text-muted-foreground">
          {format(parseISO(entry.scheduled_date), 'MMM d, yyyy')}
        </span>
        {localStatus && (
          <span
            className={`ml-auto inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${
              localStatus === 'approved'
                ? 'bg-emerald-500/10 text-emerald-600'
                : localStatus === 'rejected'
                ? 'bg-red-500/10 text-red-600'
                : 'bg-amber-500/10 text-amber-600'
            }`}
          >
            <span aria-hidden>
              {localStatus === 'approved' ? '✓' : localStatus === 'rejected' ? '✕' : '•'}
            </span>
            {localStatus === 'pending_review'
              ? 'Pending review'
              : localStatus.charAt(0).toUpperCase() + localStatus.slice(1)}
          </span>
        )}
      </div>

      <div className="px-4 py-4 space-y-3">
        {entry.title && <p className="font-semibold text-sm">{entry.title}</p>}
        {bodyText && (
          <div>
            <p className={`text-sm text-muted-foreground leading-relaxed ${!expanded && isLong ? 'line-clamp-4' : ''}`}>
              {bodyText}
            </p>
            {isLong && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-primary mt-1 hover:underline"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        {!localStatus && (
          <div className="pt-1 space-y-2">
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
                  placeholder="Optional note for the team…"
                  rows={3}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => submit('rejected')}
                    disabled={submitting}
                    className="flex-1 rounded-lg bg-red-500 text-white text-sm font-medium py-2 hover:bg-red-600 disabled:opacity-60 transition-colors"
                  >
                    {submitting ? 'Sending…' : 'Submit Rejection'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReject(false)}
                    className="rounded-lg border border-border text-sm font-medium px-4 py-2 hover:bg-accent transition-colors"
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
                  className="flex-1 rounded-lg bg-emerald-500 text-white text-sm font-medium py-2 hover:bg-emerald-600 disabled:opacity-60 transition-colors"
                >
                  {submitting ? 'Saving…' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReject(true)}
                  className="flex-1 rounded-lg border border-border text-sm font-medium py-2 hover:bg-accent transition-colors"
                >
                  Request Changes
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PublicApprovalPage() {
  const { token } = useParams<{ token: string }>()
  const queryClient = useQueryClient()

  const tokenValid = !!token && UUID_RE.test(token)

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-approval', token],
    queryFn: async () => {
      const res = await fetch(`${FUNCTIONS_URL}/submit-approval?token=${encodeURIComponent(token!)}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? json?.message ?? `Server returned ${res.status}`)
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm space-y-2 px-6">
          <p className="text-lg font-semibold">Link unavailable</p>
          <p className="text-sm text-muted-foreground">
            This approval link is invalid or has expired.
          </p>
        </div>
      </div>
    )
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
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm space-y-2 px-6">
          <p className="text-lg font-semibold">Link unavailable</p>
          <p className="text-sm text-muted-foreground">
            This approval link is invalid or has expired.
          </p>
        </div>
      </div>
    )
  }

  const { brand, entries } = data
  const pending = entries.filter((e) => !e.approval_status)
  const allActioned = entries.length > 0 && pending.length === 0

  return (
    <div className="min-h-screen bg-background">
      {/* Header stripe */}
      <div
        className="h-2 w-full"
        style={{ backgroundColor: brand.color || '#6366f1' }}
      />

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Brand info */}
        <div>
          <h1 className="text-2xl font-bold">{brand.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {allActioned ? (
              'All done! Thanks for reviewing.'
            ) : (
              <>
                <span className="font-medium text-foreground">{pending.length}</span>{' '}
                {pending.length === 1 ? 'item' : 'items'} pending your review
              </>
            )}
          </p>
        </div>

        {allActioned ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-semibold">All done!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Thanks for reviewing all the content. The team has been notified.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <ApprovalCard
                key={entry.id}
                entry={entry}
                token={token!}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border pt-6 text-center">
          <p className="text-xs text-muted-foreground">Powered by Zek Studio</p>
        </div>
      </div>
    </div>
  )
}
