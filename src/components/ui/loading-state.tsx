import { Loader2 } from 'lucide-react'

// Single source of truth for loading visuals across the app.
//
//   page         — calm centered spinner with subtle label (route boots, brand switches)
//   inline       — small spinner + label inline with surrounding text
//   skeleton     — stack of pulsing bars (generic placeholder)
//   dashboard    — KPI tiles + digest skeleton matching the Dashboard layout
//   calendar     — month-grid skeleton matching the Calendar layout
//   board        — three-column board skeleton matching TaskBoard layout
//
// The page-shaped skeletons are the premium upgrade — they pre-paint the
// layout the user is about to see so the perceived load drops sharply.

interface LoadingStateProps {
  variant?: 'page' | 'inline' | 'skeleton' | 'dashboard' | 'calendar' | 'board'
  label?: string
  // For skeleton variant: how many bars to render. Defaults to 3.
  lines?: number
  className?: string
}

function PulseBar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded bg-gradient-to-r from-muted-foreground/10 via-muted-foreground/15 to-muted-foreground/10 motion-safe:animate-pulse ${className ?? ''}`}
      style={style}
      aria-hidden
    />
  )
}

export function LoadingState({
  variant = 'page',
  label,
  lines = 3,
  className,
}: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <div className={`space-y-2 ${className ?? ''}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <PulseBar
            key={i}
            className="h-3"
            style={{ width: `${85 - i * 12}%` }}
          />
        ))}
        <span className="sr-only">{label ?? 'Loading…'}</span>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <span
        className={`inline-flex items-center gap-2 text-xs text-muted-foreground ${className ?? ''}`}
        role="status"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {label ?? 'Loading…'}
      </span>
    )
  }

  if (variant === 'dashboard') {
    return (
      <div className={`flex flex-col gap-4 p-6 ${className ?? ''}`} role="status" aria-live="polite">
        {/* Data tape */}
        <PulseBar className="h-4 w-2/3" />
        {/* Greeting */}
        <div className="space-y-2 mt-2">
          <PulseBar className="h-3 w-32" />
          <PulseBar className="h-9 w-72" />
          <PulseBar className="h-3 w-48" />
        </div>
        {/* KPI tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="premium-card rounded-xl ring-1 ring-border/80 p-4 space-y-3"
            >
              <PulseBar className="h-3 w-20" />
              <PulseBar className="h-7 w-24" />
              <PulseBar className="h-2.5 w-16" />
            </div>
          ))}
        </div>
        {/* Bento */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3 mt-1">
          <div className="premium-card rounded-xl ring-1 ring-border/80 p-4 space-y-3">
            <PulseBar className="h-4 w-32" />
            <PulseBar className="h-2 w-full" />
            <PulseBar className="h-2 w-full" />
            <PulseBar className="h-2 w-3/4" />
          </div>
          <div className="premium-card rounded-xl ring-1 ring-border/80 p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <PulseBar key={i} className="h-5 w-full" />
            ))}
          </div>
        </div>
        <span className="sr-only">{label ?? 'Loading…'}</span>
      </div>
    )
  }

  if (variant === 'calendar') {
    return (
      <div className={`flex flex-col gap-3 p-6 ${className ?? ''}`} role="status" aria-live="polite">
        <div className="flex items-center justify-between">
          <PulseBar className="h-7 w-48" />
          <PulseBar className="h-7 w-32" />
        </div>
        <div className="grid grid-cols-7 gap-px bg-border/40 rounded-xl overflow-hidden">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="bg-card aspect-square p-2 space-y-2">
              <PulseBar className="h-3 w-4" />
              {i % 3 === 0 && <PulseBar className="h-4 w-full" />}
              {i % 4 === 0 && <PulseBar className="h-4 w-3/4" />}
            </div>
          ))}
        </div>
        <span className="sr-only">{label ?? 'Loading…'}</span>
      </div>
    )
  }

  if (variant === 'board') {
    return (
      <div className={`flex flex-col gap-4 p-6 ${className ?? ''}`} role="status" aria-live="polite">
        <PulseBar className="h-7 w-32" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, col) => (
            <div
              key={col}
              className="premium-card rounded-xl ring-1 ring-border/80 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <PulseBar className="h-4 w-24" />
                <PulseBar className="h-4 w-6 rounded-full" />
              </div>
              {Array.from({ length: 3 + ((col + 1) % 3) }).map((_, i) => (
                <div key={i} className="rounded-md border border-border/60 bg-card/60 p-2.5 space-y-1.5">
                  <PulseBar className="h-3 w-3/4" />
                  <PulseBar className="h-2.5 w-1/2" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <span className="sr-only">{label ?? 'Loading…'}</span>
      </div>
    )
  }

  // page — calm centered spinner with editorial label
  return (
    <div
      className={`flex h-full min-h-[40vh] flex-col items-center justify-center gap-2.5 ${className ?? ''}`}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" aria-hidden />
      <span
        className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground/60"
      >
        {label ?? 'Loading'}
      </span>
    </div>
  )
}
