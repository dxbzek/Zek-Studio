import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { humanizeAuthError } from '@/lib/authErrors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import logoSrc from '/logo.png'

export function LoginPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  async function handleForgotPassword() {
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Enter your email first, then hit "Forgot password?" again.')
      return
    }
    setResetLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/reset`,
      })
      if (error) throw error
      toast.success('Reset email sent', { description: 'Check your inbox for a link to set a new password.' })
    } catch (err) {
      setError(humanizeAuthError(err instanceof Error ? err.message : 'Could not send reset email.'))
    } finally {
      setResetLoading(false)
    }
  }

  async function handleResendConfirmation() {
    const trimmed = email.trim()
    if (!trimmed) return
    setSubmitting(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: trimmed })
      if (error) throw error
      toast.success('Confirmation email resent', { description: 'Check your inbox (and spam folder).' })
    } catch (err) {
      setError(humanizeAuthError(err instanceof Error ? err.message : 'Could not resend confirmation.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) setError(humanizeAuthError(error.message))
    // The successful path redirects away and unmounts this page. Re-enable the
    // button either way so a blocked/cancelled redirect doesn't strand the UI.
    setGoogleLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/')
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) {
          // Supabase surfaces duplicate-email as "User already registered" (422).
          // Catch it and route the user to sign-in instead of a generic error.
          if (/already\s+registered|already\s+been\s+registered/i.test(error.message)) {
            setError('An account with that email already exists. Try signing in instead.')
            setMode('login')
            return
          }
          throw error
        }
        // Supabase returns a user with empty identities[] when the email is
        // already taken but confirmations are enabled — still treat as dup.
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setError('An account with that email already exists. Try signing in instead.')
          setMode('login')
          return
        }
        setSuccessMsg('Account created! Check your email to confirm.')
        setMode('login')
      }
    } catch (err: unknown) {
      setError(humanizeAuthError(err instanceof Error ? err.message : 'Something went wrong.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen" style={{ gridTemplateColumns: '1.1fr 1fr' }}>
      {/* Left panel — editorial */}
      <div
        className="relative hidden md:flex flex-col justify-between p-10 border-r border-border overflow-hidden"
        style={{ background: 'var(--sidebar)' }}
      >
        {/* Dot grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, oklch(0.5 0 0 / 0.07) 1px, transparent 1px),
              linear-gradient(to bottom, oklch(0.5 0 0 / 0.07) 1px, transparent 1px)
            `,
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 80% 70% at 20% 30%, black 20%, transparent 80%)',
          }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-500">
          <img src={logoSrc} alt="Zek" className="h-[18px] w-auto dark:invert" />
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, letterSpacing: '-0.02em' }}>
            Studio
          </span>
        </div>

        {/* Editorial headline */}
        <div className="relative max-w-[480px]">
          <div className="eyebrow mb-5 animate-in fade-in slide-in-from-bottom-3 duration-700" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>Vol. 04 · Spring '26</div>
          <h1
            className="animate-in fade-in slide-in-from-bottom-4 duration-700"
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(44px, 5.2vw, 64px)',
              fontWeight: 400,
              lineHeight: 1.08,
              letterSpacing: '-0.025em',
              marginBottom: 22,
              animationDelay: '200ms',
              animationFillMode: 'backwards',
            }}
          >
            Your strategist,<br />
            <em style={{ fontStyle: 'italic', color: 'var(--muted-foreground)' }}>in the corner.</em>
          </h1>
          <p
            className="animate-in fade-in slide-in-from-bottom-3 duration-700"
            style={{ color: 'var(--muted-foreground)', fontSize: 14, lineHeight: 1.55, maxWidth: 360, animationDelay: '350ms', animationFillMode: 'backwards' }}
          >
            Research niches, ship content, and track what lands — from one calm workspace. No growth hacks, no confetti.
          </p>
        </div>

        {/* Footer spacer */}
        <div />
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-[360px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 md:hidden">
            <img src={logoSrc} alt="Zek" className="h-[18px] w-auto dark:invert" />
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, letterSpacing: '-0.02em' }}>
              Studio
            </span>
          </div>

          <div className="eyebrow mb-3">
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </div>
          <h2
            style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 500, letterSpacing: '-0.025em', marginBottom: 8 }}
          >
            {mode === 'login' ? 'Welcome back.' : 'Get started.'}
          </h2>
          <p className="text-[13px] text-muted-foreground mb-7">
            {mode === 'login'
              ? 'Enter your credentials to access your workspace.'
              : 'Set up your free Zek Studio account.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[11px] font-medium text-muted-foreground">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-[11px] font-medium text-muted-foreground">Password</Label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetLoading}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {resetLoading ? 'Sending…' : 'Forgot password?'}
                  </button>
                )}
              </div>
              <Input id="password" type="password"
                placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
                <p>{error}</p>
                {/* Inline recovery for the most common actionable error. */}
                {/confirmation link/i.test(error) && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={submitting}
                    className="mt-1 underline underline-offset-2 text-[11px] font-medium disabled:opacity-40"
                  >
                    Resend confirmation email
                  </button>
                )}
              </div>
            )}
            {successMsg && (
              <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[12.5px] text-emerald-600 dark:text-emerald-400">{successMsg}</p>
            )}

            <Button type="submit" className="w-full h-[38px] gap-2 mt-1" disabled={submitting}>
              {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              {!submitting && <ArrowRight className="h-3.5 w-3.5" />}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button
            variant="outline"
            className="w-full h-[38px] text-[13px]"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
          >
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </Button>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            {mode === 'login' ? (
              <>New to Zek?{' '}
                <button type="button" onClick={() => { setMode('signup'); setError(null) }}
                  className="text-foreground hover:underline underline-offset-2">
                  Request access
                </button>
              </>
            ) : (
              <>Already have one?{' '}
                <button type="button" onClick={() => { setMode('login'); setError(null) }}
                  className="text-foreground hover:underline underline-offset-2">
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
