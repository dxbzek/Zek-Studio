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
