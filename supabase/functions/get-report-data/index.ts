// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) {
      return new Response(JSON.stringify({ error: 'token required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY)

    const { data: tokenRow } = await sb
      .from('share_tokens')
      .select('*')
      .eq('token', token)
      .eq('type', 'report')
      .single()

    if (!tokenRow) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Report link has expired' }), {
        status: 410,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const brandId = tokenRow.brand_id
    const [{ data: brand }, { data: metrics }] = await Promise.all([
      sb
        .from('brand_profiles')
        .select('name, niche, color, platforms')
        .eq('id', brandId)
        .single(),
      sb
        .from('post_metrics')
        .select('*')
        .eq('brand_id', brandId)
        .order('posted_at', { ascending: false }),
    ])

    return new Response(JSON.stringify({ brand, metrics: metrics ?? [] }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
