import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  if (!loading && user) return <Navigate to="/" replace />

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
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSuccessMsg('Account created! Check your email to confirm.')
        setMode('login')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
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
        <div className="relative flex items-center gap-2.5">
          <img src="/logo.png" alt="Zek" className="h-[18px] w-auto dark:invert" />
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, letterSpacing: '-0.02em' }}>
            Studio
          </span>
        </div>

        {/* Editorial headline */}
        <div className="relative max-w-[480px]">
          <div className="eyebrow mb-5">Vol. 04 · Spring '26</div>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(44px, 5.2vw, 64px)',
              fontWeight: 400,
              lineHeight: 1.08,
              letterSpacing: '-0.025em',
              marginBottom: 22,
            }}
          >
            Your strategist,<br />
            <em style={{ fontStyle: 'italic', color: 'var(--muted-foreground)' }}>in the corner.</em>
          </h1>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14, lineHeight: 1.55, maxWidth: 360 }}>
            Research niches, ship content, and track what lands — from one calm workspace. No growth hacks, no confetti.
          </p>
        </div>

        {/* Footer */}
        <div
          className="relative flex items-center gap-6 text-[11px] text-muted-foreground"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <span>EST. 2025</span>
          <span>DXB · REMOTE</span>
          <span>SOC 2 · IN PROGRESS</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-[360px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 md:hidden">
            <img src="/logo.png" alt="Zek" className="h-[18px] w-auto dark:invert" />
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
                  <a href="#" className="text-[11px] text-muted-foreground hover:text-foreground">Forgot?</a>
                )}
              </div>
              <Input id="password" type="password"
                placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">{error}</p>
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

          <Button variant="outline" className="w-full h-[38px] text-[13px]">
            Continue with Google
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
