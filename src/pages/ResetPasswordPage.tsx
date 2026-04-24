import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Supabase's recovery flow: the email link brings the user here with a
// session that was created from the recovery token. We detect the
// PASSWORD_RECOVERY event, show a new-password form, and call updateUser.
// If the user hits /reset without coming from an email, we just let them
// try — Supabase will reject the password change without a session.
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the recovery token in the URL
    // has been exchanged for a session. detectSessionInUrl (default true)
    // is what does the exchange.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setHasRecoverySession(true)
      else if (session) setHasRecoverySession(true)
    })
    // Also check current state on mount — if the user hit this route after
    // the event fired (tab-switch etc) we still want the form available.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasRecoverySession(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords don\'t match.')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => navigate('/'), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set new password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-[360px]">
        <div className="eyebrow mb-3">Reset password</div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 500, letterSpacing: '-0.025em', marginBottom: 8 }}>
          Set a new password.
        </h2>
        <p className="text-[13px] text-muted-foreground mb-7">
          {hasRecoverySession
            ? 'Pick something new — you\'ll be signed in after saving.'
            : 'If you reached this page without using the email link, request a new reset from the sign-in page.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-[11px] font-medium text-muted-foreground">New password</Label>
            <Input id="new-password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={6}
              placeholder="At least 6 characters" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-[11px] font-medium text-muted-foreground">Confirm password</Label>
            <Input id="confirm-password" type="password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">{error}</p>
          )}
          {success && (
            <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[12.5px] text-emerald-600 dark:text-emerald-400">
              Password updated. Redirecting…
            </p>
          )}

          <Button type="submit" className="w-full h-[38px] gap-2 mt-1" disabled={submitting || success}>
            {submitting ? 'Saving…' : 'Save new password'}
            {!submitting && !success && <ArrowRight className="h-3.5 w-3.5" />}
          </Button>
        </form>
      </div>
    </div>
  )
}
