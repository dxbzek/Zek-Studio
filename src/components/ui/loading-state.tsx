import { Loader2 } from 'lucide-react'

// Single source of truth for loading visuals across the app. Three variants
// match the three contexts where things load:
//
//   page    — full-height centered spinner (route boots, brand switches)
//   inline  — small spinner + label inline with surrounding text (mutations,
//             list refresh, anywhere a row is doing async work in-place)
//   skeleton — a stack of pulsing gray bars approximating final content
//             (use when the layout matters; pulses imply content is coming)
//
// Replaces ad-hoc `animate-spin border-4` blocks and inline `Loader2`s.

interface LoadingStateProps {
  variant?: 'page' | 'inline' | 'skeleton'
  label?: string
  // For skeleton variant: how many bars to render. Defaults to 3.
  lines?: number
  className?: string
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
          <div
            key={i}
            className="h-3 rounded bg-muted-foreground/15 animate-pulse"
            style={{ width: `${85 - i * 12}%` }}
            aria-hidden
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

  // page
  return (
    <div
      className={`flex h-full min-h-[40vh] items-center justify-center ${className ?? ''}`}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">{label ?? 'Loading…'}</span>
    </div>
  )
}
