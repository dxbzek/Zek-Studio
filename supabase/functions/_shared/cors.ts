// Shared CORS helper.
//
// Authenticated endpoints should echo back a specific, allowlisted Origin —
// not a wildcard — so a rogue site can't trick a logged-in user's browser
// into making credentialed requests on their behalf.
//
// Configure additional origins via ALLOWED_ORIGINS (comma-separated) env var.
// Vercel preview URLs (*.vercel.app) are allowed by pattern to keep PR previews
// working without listing each one.
//
// For public, unauthenticated endpoints (share-token pages), keep the existing
// `Access-Control-Allow-Origin: *` — the token itself is the auth.

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
]

const VERCEL_PREVIEW = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i

function parseAllowed(): string[] {
  const extra = Deno.env.get('ALLOWED_ORIGINS') ?? ''
  const list = extra.split(',').map((s) => s.trim()).filter(Boolean)
  return Array.from(new Set([...list, ...DEFAULT_ORIGINS]))
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allowed = parseAllowed()
  const ok = allowed.includes(origin) || VERCEL_PREVIEW.test(origin)
  return {
    'Access-Control-Allow-Origin': ok ? origin : (allowed[0] ?? 'null'),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
}

export const publicCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
