// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  const CORS_HEADERS = corsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Verify the caller is authenticated via REST (avoids local JWT algorithm issues)
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': authHeader,
      },
    })
    if (!userRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }
    const user = await userRes.json()

    const { email, brand_id } = await req.json() as { email: string; brand_id: string }

    if (!email || !brand_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, brand_id' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // Verify the caller owns this brand
    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brand_profiles')
      .select('id')
      .eq('id', brand_id)
      .eq('user_id', user.id)
      .single()

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: 'Brand not found or access denied' }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // Check if already invited
    const { data: existing } = await supabaseAdmin
      .from('team_members')
      .select('id, accepted_at')
      .eq('brand_id', brand_id)
      .eq('email', email.toLowerCase())
      .single()

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'This email has already been invited to this brand' }),
        { status: 409, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const redirectTo = `${req.headers.get('origin') ?? SUPABASE_URL}/tasks`
    const normalizedEmail = email.toLowerCase()

    // Look up the invited user *first* via admin API. If they already exist
    // we'll skip the invite email entirely (which would 422) and just record
    // the team_members row + hand back a magic link. This used to happen
    // *after* the invite call, which meant existing-user invites wasted a
    // slot of the hourly email rate limit before we even got to the lookup.
    const lookupRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(normalizedEmail)}`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    )
    const lookupData = await lookupRes.json() as { users?: Array<{ id: string }> }
    let invitedUserId: string | null = lookupData.users?.[0]?.id ?? null
    const alreadyRegistered = !!invitedUserId

    // Step 1: insert the team_members row. Doing this *before* the email
    // means a check-constraint or RLS failure surfaces immediately and
    // doesn't burn the hourly invite-email quota.
    const { data: member, error: memberError } = await supabaseAdmin
      .from('team_members')
      .insert({
        brand_id,
        user_id: invitedUserId,
        email: normalizedEmail,
        role: 'editor',
      })
      .select()
      .single()

    if (memberError) throw new Error(memberError.message)

    // Step 2: send the email or generate a share link. Failures here are
    // non-fatal — the row exists, the inviter can retry email separately
    // or just hand the link to the user.
    let emailed = false
    let actionLink: string | null = null
    let emailError: string | null = null

    if (alreadyRegistered) {
      // Existing user — inviteUserByEmail would 422. Generate a magic link
      // the owner can share manually instead.
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizedEmail,
        options: { redirectTo },
      })
      if (linkErr) emailError = linkErr.message
      actionLink = linkData?.properties?.action_link ?? null
    } else {
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        normalizedEmail,
        {
          data: { role: 'editor', brand_id },
          redirectTo,
        },
      )
      if (inviteError) {
        emailError = inviteError.message
      } else {
        emailed = true
        // Backfill user_id now that we have one — the row was inserted with null.
        const newUserId = inviteData?.user?.id ?? null
        if (newUserId) {
          await supabaseAdmin
            .from('team_members')
            .update({ user_id: newUserId })
            .eq('id', member.id)
          invitedUserId = newUserId
        }
      }
    }

    return new Response(
      JSON.stringify({ member, emailed, alreadyRegistered, actionLink, emailError }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
