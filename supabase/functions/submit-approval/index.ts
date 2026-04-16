// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const sb = createClient(SUPABASE_URL, SERVICE_KEY)

  // GET: fetch entries pending approval
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) {
      return new Response(JSON.stringify({ error: 'token required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const { data: tokenRow } = await sb
      .from('share_tokens')
      .select('*')
      .eq('token', token)
      .eq('type', 'approval')
      .single()

    if (!tokenRow) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Link expired' }), {
        status: 410,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const [{ data: brand }, { data: entries }] = await Promise.all([
      sb
        .from('brand_profiles')
        .select('name, niche, color')
        .eq('id', tokenRow.brand_id)
        .single(),
      sb
        .from('calendar_entries')
        .select('id, platform, title, body, scheduled_date, status, approval_status, approval_note')
        .eq('brand_id', tokenRow.brand_id)
        .in('status', ['draft', 'scheduled'])
        .order('scheduled_date', { ascending: true }),
    ])

    return new Response(JSON.stringify({ brand, entries: entries ?? [] }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // POST: submit approval/rejection
  if (req.method === 'POST') {
    try {
      const { token, entry_id, action, note } = (await req.json()) as {
        token: string
        entry_id: string
        action: 'approved' | 'rejected'
        note?: string
      }

      const { data: tokenRow } = await sb
        .from('share_tokens')
        .select('*')
        .eq('token', token)
        .eq('type', 'approval')
        .single()

      if (!tokenRow) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 403,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      const { data: entry } = await sb
        .from('calendar_entries')
        .select('brand_id')
        .eq('id', entry_id)
        .single()

      if (!entry || entry.brand_id !== tokenRow.brand_id) {
        return new Response(JSON.stringify({ error: 'Entry not found' }), {
          status: 404,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }

      await sb
        .from('calendar_entries')
        .update({
          approval_status: action,
          approval_note: note ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entry_id)

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    } catch (err) {
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
  }

  return new Response('Method not allowed', { status: 405 })
})
