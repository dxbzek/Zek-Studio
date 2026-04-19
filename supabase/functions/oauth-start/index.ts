// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CALLBACK_BASE = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Validate caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { brand_id, platform } = await req.json() as { brand_id: string; platform: string }
    if (!brand_id || !platform) {
      return new Response(JSON.stringify({ error: 'brand_id and platform are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify brand ownership
    const { data: brand, error: brandError } = await supabase
      .from('brand_profiles')
      .select('id')
      .eq('id', brand_id)
      .eq('user_id', user.id)
      .single()
    if (brandError || !brand) {
      return new Response(JSON.stringify({ error: 'Brand not found or access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Store state for CSRF protection
    const { data: stateRow, error: stateError } = await supabase
      .from('oauth_states')
      .insert({ brand_id, platform })
      .select('state')
      .single()
    if (stateError || !stateRow) {
      throw new Error('Failed to create OAuth state')
    }
    const state = stateRow.state as string
    const callbackUrl = `${CALLBACK_BASE}?platform=${platform}`

    let authUrl: string

    if (platform === 'meta' || platform === 'instagram' || platform === 'facebook') {
      const appId = Deno.env.get('META_APP_ID')!
      const scopes = [
        'instagram_basic',
        'instagram_manage_insights',
        'pages_read_engagement',
        'pages_show_list',
      ].join(',')
      authUrl = `https://www.facebook.com/v21.0/dialog/oauth?` +
        `client_id=${appId}` +
        `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&state=${state}`
    } else if (platform === 'tiktok') {
      const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY')!
      const scopes = ['user.info.basic', 'video.list'].join(',')
      authUrl = `https://www.tiktok.com/v2/auth/authorize?` +
        `client_key=${clientKey}` +
        `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&state=${state}` +
        `&response_type=code`
    } else if (platform === 'youtube') {
      const clientId = Deno.env.get('YOUTUBE_CLIENT_ID')!
      const scopes = [
        'https://www.googleapis.com/auth/yt-analytics.readonly',
        'https://www.googleapis.com/auth/youtube.readonly',
      ].join(' ')
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&state=${state}` +
        `&response_type=code` +
        `&access_type=offline` +
        `&prompt=consent`
    } else {
      return new Response(JSON.stringify({ error: `Unsupported platform: ${platform}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ url: authUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('oauth-start error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
