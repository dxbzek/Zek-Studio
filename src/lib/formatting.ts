// Shared number formatting. `fmtCompact` always returns a string (falls back
// to '—' for null/undefined). `fmtCompactOrNull` collapses zero/missing to
// null so callers can skip rendering empty stats.

export function fmtCompact(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export function fmtCompactOrNull(n: number | null | undefined): string | null {
  if (n == null || n === 0) return null
  return fmtCompact(n)
}

// Safely extracts a human-readable message from anything a catch block might
// receive. Avoids the (err as Error).message cast that crashes on non-Error
// throws (e.g. thrown strings, Supabase SDK objects without .message).
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message: unknown }).message
    if (typeof m === 'string') return m
  }
  return fallback
}

// True when `YYYY-MM-DD` falls inside the given month/year. Tolerant of null
// inputs so callers don't need an extra guard before filtering.
export function isInMonth(
  dateStr: string | null | undefined,
  month: number,
  year: number,
): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr + 'T00:00:00')
  return d.getMonth() === month && d.getFullYear() === year
}
