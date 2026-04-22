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

    // Try to send Supabase invite email (creates auth account for new users)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.toLowerCase(),
      {
        data: { role: 'specialist', brand_id },
        redirectTo,
      },
    )

    // Track what we tell the client
    let emailed = !inviteError
    let actionLink: string | null = null
    let alreadyRegistered = false

    if (inviteError) {
      if (inviteError.message?.includes('already been registered')) {
        alreadyRegistered = true
        // Existing user — inviteUserByEmail won't send, so generate a magic link
        // the owner can share manually or our own mailer could use.
        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: email.toLowerCase(),
          options: { redirectTo },
        })
        actionLink = linkData?.properties?.action_link ?? null
      } else {
        throw new Error(inviteError.message)
      }
    }

    // Look up the invited user's id if they already exist
    let invitedUserId: string | null = inviteData?.user?.id ?? null
    if (!invitedUserId) {
      const lookupRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email.toLowerCase())}`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        },
      )
      const lookupData = await lookupRes.json() as { users?: Array<{ id: string }> }
      invitedUserId = lookupData.users?.[0]?.id ?? null
    }

    // Insert team_members row
    const { data: member, error: memberError } = await supabaseAdmin
      .from('team_members')
      .insert({
        brand_id,
        user_id: invitedUserId,
        email: email.toLowerCase(),
        role: 'specialist',
      })
      .select()
      .single()

    if (memberError) throw new Error(memberError.message)

    return new Response(
      JSON.stringify({ member, emailed, alreadyRegistered, actionLink }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
