import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CALLBACK_BASE = `${SUPABASE_URL}/functions/v1/oauth-callback`

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const platform = url.searchParams.get('platform') ?? ''
  const code = url.searchParams.get('code') ?? ''
  const state = url.searchParams.get('state') ?? ''
  const errorParam = url.searchParams.get('error')

  const redirectError = (msg: string) =>
    Response.redirect(`${APP_URL}/analytics?error=${encodeURIComponent(msg)}`, 302)

  if (errorParam) return redirectError(`Platform denied access: ${errorParam}`)
  if (!code || !state || !platform) return redirectError('Missing code, state or platform')

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Validate state and get brand_id
  const { data: stateRow, error: stateErr } = await supabase
    .from('oauth_states')
    .select('brand_id, platform, created_at')
    .eq('state', state)
    .single()

  if (stateErr || !stateRow) return redirectError('Invalid or expired OAuth state')

  // Delete used + expired states
  await supabase.from('oauth_states').delete().eq('state', state)
  await supabase
    .from('oauth_states')
    .delete()
    .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())

  // State platform must match URL platform
  if (stateRow.platform !== platform && !(platform === 'meta' && ['instagram', 'facebook'].includes(stateRow.platform))) {
    return redirectError('Platform mismatch in OAuth state')
  }

  const brandId = stateRow.brand_id as string
  const callbackUrl = `${CALLBACK_BASE}?platform=${platform}`

  try {
    if (platform === 'meta') {
      await handleMeta(supabase, brandId, code, callbackUrl)
    } else if (platform === 'tiktok') {
      await handleTikTok(supabase, brandId, code, callbackUrl)
    } else if (platform === 'youtube') {
      await handleYouTube(supabase, brandId, code, callbackUrl)
    } else {
      return redirectError(`Unsupported platform: ${platform}`)
    }
  } catch (err) {
    console.error(`oauth-callback [${platform}] error:`, err)
    return redirectError((err as Error).message)
  }

  return Response.redirect(`${APP_URL}/analytics?connected=${platform}`, 302)
})

// ── Meta (Instagram + Facebook) ───────────────────────────────────────────────
async function handleMeta(
  supabase: ReturnType<typeof createClient>,
  brandId: string,
  code: string,
  callbackUrl: string,
) {
  const appId = Deno.env.get('META_APP_ID')!
  const appSecret = Deno.env.get('META_APP_SECRET')!

  // Exchange code for short-lived token
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` +
    `client_id=${appId}&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&client_secret=${appSecret}&code=${code}`,
  )
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) throw new Error(`Meta token error: ${JSON.stringify(tokenData)}`)

  // Exchange for long-lived token (60 days)
  const llRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` +
    `grant_type=fb_exchange_token&client_id=${appId}` +
    `&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`,
  )
  const llData = await llRes.json()
  const accessToken: string = llData.access_token ?? tokenData.access_token
  const expiresIn: number = llData.expires_in ?? 0

  // Fetch connected Instagram business account
  const meRes = await fetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name,instagram_business_account&access_token=${accessToken}`,
  )
  const meData = await meRes.json()
  const accountName: string = meData.name ?? 'Unknown'
  const accountId: string = meData.instagram_business_account?.id ?? meData.id

  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null

  // Upsert both instagram and facebook rows (same token)
  for (const plat of ['instagram', 'facebook'] as const) {
    await supabase.from('platform_connections').upsert(
      {
        brand_id: brandId,
        platform: plat,
        access_token: accessToken,
        refresh_token: null,
        token_expires_at: expiresAt,
        platform_account_id: accountId,
        platform_account_name: accountName,
        scopes: ['instagram_basic', 'instagram_manage_insights', 'pages_read_engagement'],
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'brand_id,platform' },
    )
  }
}

// ── TikTok ────────────────────────────────────────────────────────────────────
async function handleTikTok(
  supabase: ReturnType<typeof createClient>,
  brandId: string,
  code: string,
  callbackUrl: string,
) {
  const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY')!
  const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET')!

  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl,
    }),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) throw new Error(`TikTok token error: ${JSON.stringify(tokenData)}`)

  const accessToken: string = tokenData.access_token
  const refreshToken: string = tokenData.refresh_token ?? null
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null

  // Fetch user info
  const userRes = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  const userData = await userRes.json()
  const displayName: string = userData.data?.user?.display_name ?? 'Unknown'
  const openId: string = userData.data?.user?.open_id ?? ''

  await supabase.from('platform_connections').upsert(
    {
      brand_id: brandId,
      platform: 'tiktok',
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,
      platform_account_id: openId,
      platform_account_name: displayName,
      scopes: ['user.info.basic', 'video.list'],
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'brand_id,platform' },
  )
}

// ── YouTube ───────────────────────────────────────────────────────────────────
async function handleYouTube(
  supabase: ReturnType<typeof createClient>,
  brandId: string,
  code: string,
  callbackUrl: string,
) {
  const clientId = Deno.env.get('YOUTUBE_CLIENT_ID')!
  const clientSecret = Deno.env.get('YOUTUBE_CLIENT_SECRET')!

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl,
    }),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) throw new Error(`YouTube token error: ${JSON.stringify(tokenData)}`)

  const accessToken: string = tokenData.access_token
  const refreshToken: string = tokenData.refresh_token ?? null
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null

  // Fetch channel info
  const channelRes = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  const channelData = await channelRes.json()
  const channel = channelData.items?.[0]
  const channelName: string = channel?.snippet?.title ?? 'Unknown'
  const channelId: string = channel?.id ?? ''

  await supabase.from('platform_connections').upsert(
    {
      brand_id: brandId,
      platform: 'youtube',
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,
      platform_account_id: channelId,
      platform_account_name: channelName,
      scopes: [
        'https://www.googleapis.com/auth/yt-analytics.readonly',
        'https://www.googleapis.com/auth/youtube.readonly',
      ],
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'brand_id,platform' },
  )
}
