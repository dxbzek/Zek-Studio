// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
// Shared auth helpers for edge functions.
// - requireUser: verifies the Bearer JWT and returns the user (or a 401 Response)
// - requireBrandAccess: verifies the user owns the brand or is an accepted team member (or a 403 Response)

type Supa = ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>

export type AuthOk = { user: { id: string; email?: string | null }; error?: undefined }
export type AuthFail = { user?: undefined; error: Response }

export async function requireUser(
  req: Request,
  sb: Supa,
  cors: Record<string, string>,
): Promise<AuthOk | AuthFail> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return {
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      }),
    }
  }

  const token = authHeader.replace(/^Bearer\s+/i, '')
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data?.user) {
    return {
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      }),
    }
  }

  return { user: data.user }
}

export async function requireBrandAccess(
  sb: Supa,
  brandId: string,
  userId: string,
  userEmail: string | null | undefined,
  cors: Record<string, string>,
): Promise<{ ok: true } | { ok?: undefined; error: Response }> {
  // 1. Owner path
  const { data: brand } = await sb
    .from('brand_profiles')
    .select('id, user_id')
    .eq('id', brandId)
    .maybeSingle()

  if (!brand) {
    return {
      error: new Response(JSON.stringify({ error: 'Brand not found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      }),
    }
  }

  if (brand.user_id === userId) return { ok: true }

  // 2. Accepted team member path
  const email = (userEmail ?? '').toLowerCase()
  const { data: member } = await sb
    .from('team_members')
    .select('id')
    .eq('brand_id', brandId)
    .not('accepted_at', 'is', null)
    .or(`user_id.eq.${userId}${email ? `,email.eq.${email}` : ''}`)
    .maybeSingle()

  if (member) return { ok: true }

  return {
    error: new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    }),
  }
}
