import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    // Validate caller
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

    const { brand_id, platform, since, until } = await req.json() as {
      brand_id: string
      platform: string
      since?: string  // ISO date string e.g. "2024-01-01"
      until?: string  // ISO date string e.g. "2024-03-31"
    }
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

    // Load connection
    const { data: conn, error: connError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('brand_id', brand_id)
      .eq('platform', platform)
      .single()
    if (connError || !conn) {
      return new Response(JSON.stringify({ error: `No ${platform} connection found` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Refresh token if expired (or expiring within 5 minutes)
    // Uses an optimistic lock on token_expires_at to prevent concurrent refreshes
    let accessToken: string = conn.access_token
    if (conn.token_expires_at) {
      const expiresAt = new Date(conn.token_expires_at).getTime()
      if (expiresAt < Date.now() + 5 * 60 * 1000) {
        const { count } = await supabase
          .from('platform_connections')
          .update({ token_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
          .eq('id', conn.id)
          .eq('token_expires_at', conn.token_expires_at)
          .select('id', { count: 'exact', head: true })

        if (count && count > 0) {
          accessToken = await refreshToken(supabase, conn, platform, brand_id)
        } else {
          const { data: fresh } = await supabase
            .from('platform_connections')
            .select('access_token')
            .eq('id', conn.id)
            .single()
          if (fresh?.access_token) accessToken = fresh.access_token
        }
      }
    }

    let synced = 0

    if (platform === 'instagram') {
      synced = await syncInstagram(supabase, brand_id, conn.platform_account_id, accessToken, since, until)
    } else if (platform === 'facebook') {
      synced = await syncFacebook(supabase, brand_id, conn.platform_account_id, accessToken, since, until)
    } else if (platform === 'tiktok') {
      synced = await syncTikTok(supabase, brand_id, accessToken, since, until)
    } else if (platform === 'youtube') {
      synced = await syncYouTube(supabase, brand_id, conn.platform_account_id, accessToken, since, until)
    } else {
      return new Response(JSON.stringify({ error: `Unsupported platform: ${platform}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update last_synced_at
    await supabase
      .from('platform_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('brand_id', brand_id)
      .eq('platform', platform)

    return new Response(JSON.stringify({ synced }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('sync-analytics error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ── Token refresh ─────────────────────────────────────────────────────────────
async function refreshToken(
  supabase: ReturnType<typeof createClient>,
  conn: Record<string, string>,
  platform: string,
  brandId: string,
): Promise<string> {
  if (!conn.refresh_token) throw new Error(`No refresh token available for ${platform}`)

  let newAccessToken: string
  let newRefreshToken: string | null = conn.refresh_token
  let newExpiresAt: string | null = null

  if (platform === 'instagram' || platform === 'facebook') {
    // Meta: exchange current long-lived token for a new one
    const appId = Deno.env.get('META_APP_ID')!
    const appSecret = Deno.env.get('META_APP_SECRET')!
    const res = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token&client_id=${appId}` +
      `&client_secret=${appSecret}&fb_exchange_token=${conn.access_token}`,
    )
    const data = await res.json()
    if (!data.access_token) throw new Error(`Meta refresh failed: ${JSON.stringify(data)}`)
    newAccessToken = data.access_token
    newExpiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null
  } else if (platform === 'tiktok') {
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: Deno.env.get('TIKTOK_CLIENT_KEY')!,
        client_secret: Deno.env.get('TIKTOK_CLIENT_SECRET')!,
        grant_type: 'refresh_token',
        refresh_token: conn.refresh_token,
      }),
    })
    const data = await res.json()
    if (!data.access_token) throw new Error(`TikTok refresh failed: ${JSON.stringify(data)}`)
    newAccessToken = data.access_token
    newRefreshToken = data.refresh_token ?? conn.refresh_token
    newExpiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null
  } else if (platform === 'youtube') {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('YOUTUBE_CLIENT_ID')!,
        client_secret: Deno.env.get('YOUTUBE_CLIENT_SECRET')!,
        grant_type: 'refresh_token',
        refresh_token: conn.refresh_token,
      }),
    })
    const data = await res.json()
    if (!data.access_token) throw new Error(`YouTube refresh failed: ${JSON.stringify(data)}`)
    newAccessToken = data.access_token
    newExpiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null
  } else {
    throw new Error(`Cannot refresh token for platform: ${platform}`)
  }

  await supabase
    .from('platform_connections')
    .update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_expires_at: newExpiresAt,
    })
    .eq('brand_id', brandId)
    .eq('platform', platform)

  return newAccessToken
}

// ── Instagram sync ────────────────────────────────────────────────────────────
async function syncInstagram(
  supabase: ReturnType<typeof createClient>,
  brandId: string,
  igAccountId: string,
  accessToken: string,
  since?: string,
  until?: string,
): Promise<number> {
  const sinceParam = since ? `&since=${Math.floor(new Date(since).getTime() / 1000)}` : ''
  const untilParam = until ? `&until=${Math.floor(new Date(until + 'T23:59:59').getTime() / 1000)}` : ''
  // Fetch recent media
  const mediaRes = await fetch(
    `https://graph.facebook.com/v21.0/${igAccountId}/media?` +
    `fields=id,timestamp,like_count,comments_count,media_url,permalink&limit=50` +
    `${sinceParam}${untilParam}&access_token=${accessToken}`,
  )
  const mediaData = await mediaRes.json()
  if (!mediaData.data) throw new Error(`Instagram media error: ${JSON.stringify(mediaData)}`)

  let synced = 0
  for (const post of mediaData.data) {
    // Fetch insights for this post
    const insightsRes = await fetch(
      `https://graph.facebook.com/v21.0/${post.id}/insights?` +
      `metric=impressions,reach,saved,shares&access_token=${accessToken}`,
    )
    const insightsData = await insightsRes.json()
    const metrics: Record<string, number> = {}
    if (insightsData.data) {
      for (const m of insightsData.data) {
        metrics[m.name] = m.values?.[0]?.value ?? 0
      }
    }

    const { error } = await supabase.from('post_metrics').upsert(
      {
        brand_id: brandId,
        platform: 'instagram',
        post_url: post.permalink ?? null,
        posted_at: post.timestamp ? post.timestamp.slice(0, 10) : null,
        likes: post.like_count ?? null,
        comments: post.comments_count ?? null,
        impressions: metrics.impressions ?? null,
        reach: metrics.reach ?? null,
        saves: metrics.saved ?? null,
        shares: metrics.shares ?? null,
      },
      { onConflict: 'brand_id,platform,post_url', ignoreDuplicates: false },
    )
    if (!error) synced++
  }
  return synced
}

// ── Facebook sync ─────────────────────────────────────────────────────────────
async function syncFacebook(
  supabase: ReturnType<typeof createClient>,
  brandId: string,
  pageId: string,
  accessToken: string,
  since?: string,
  until?: string,
): Promise<number> {
  // Fetch page fan_count to use as engagement denominator
  const pageRes = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}?fields=fan_count&access_token=${accessToken}`,
  )
  const pageData = await pageRes.json()
  const fanCount: number | null = pageData.fan_count ?? null

  const sinceParam = since ? `&since=${Math.floor(new Date(since).getTime() / 1000)}` : ''
  const untilParam = until ? `&until=${Math.floor(new Date(until + 'T23:59:59').getTime() / 1000)}` : ''
  const postsRes = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/posts?` +
    `fields=id,created_time,story,permalink_url,likes.summary(true),comments.summary(true),shares&limit=50` +
    `${sinceParam}${untilParam}&access_token=${accessToken}`,
  )
  const postsData = await postsRes.json()
  if (!postsData.data) throw new Error(`Facebook posts error: ${JSON.stringify(postsData)}`)

  let synced = 0
  for (const post of postsData.data) {
    const { error } = await supabase.from('post_metrics').upsert(
      {
        brand_id: brandId,
        platform: 'facebook',
        post_url: post.permalink_url ?? null,
        posted_at: post.created_time ? post.created_time.slice(0, 10) : null,
        likes: post.likes?.summary?.total_count ?? null,
        comments: post.comments?.summary?.total_count ?? null,
        shares: post.shares?.count ?? null,
        // Store fan count as reach so engagement rate = (likes+comments+shares) / followers
        reach: fanCount,
      },
      { onConflict: 'brand_id,platform,post_url', ignoreDuplicates: false },
    )
    if (!error) synced++
  }
  return synced
}

// ── TikTok sync ───────────────────────────────────────────────────────────────
async function syncTikTok(
  supabase: ReturnType<typeof createClient>,
  brandId: string,
  accessToken: string,
  since?: string,
  until?: string,
): Promise<number> {
  const res = await fetch(
    'https://open.tiktokapis.com/v2/video/list/?fields=id,title,like_count,comment_count,share_count,view_count,create_time,share_url',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_count: 50 }),
    },
  )
  const data = await res.json()
  if (!data.data?.videos) throw new Error(`TikTok video list error: ${JSON.stringify(data)}`)

  const sinceMs = since ? new Date(since).getTime() : null
  const untilMs = until ? new Date(until + 'T23:59:59').getTime() : null

  let synced = 0
  for (const video of data.data.videos) {
    const postedMs = video.create_time ? video.create_time * 1000 : null
    if (postedMs && sinceMs && postedMs < sinceMs) continue
    if (postedMs && untilMs && postedMs > untilMs) continue
    const { error } = await supabase.from('post_metrics').upsert(
      {
        brand_id: brandId,
        platform: 'tiktok',
        post_url: video.share_url ?? null,
        posted_at: video.create_time
          ? new Date(video.create_time * 1000).toISOString().slice(0, 10)
          : null,
        views: video.view_count ?? null,
        likes: video.like_count ?? null,
        comments: video.comment_count ?? null,
        shares: video.share_count ?? null,
      },
      { onConflict: 'brand_id,platform,post_url', ignoreDuplicates: false },
    )
    if (!error) synced++
  }
  return synced
}

// ── YouTube sync ──────────────────────────────────────────────────────────────
async function syncYouTube(
  supabase: ReturnType<typeof createClient>,
  brandId: string,
  _channelId: string,
  accessToken: string,
  since?: string,
  until?: string,
): Promise<number> {
  // Fetch recent uploads from the uploads playlist
  const channelRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  const channelData = await channelRes.json()
  const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploadsPlaylistId) throw new Error('Could not find YouTube uploads playlist')

  const playlistRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?` +
    `part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  const playlistData = await playlistRes.json()
  if (!playlistData.items) throw new Error(`YouTube playlist error: ${JSON.stringify(playlistData)}`)

  const videoIds = playlistData.items
    .map((item: Record<string, Record<string, Record<string, string>>>) => item.contentDetails?.videoId)
    .filter(Boolean)
    .join(',')

  if (!videoIds) return 0

  // Fetch video statistics
  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?` +
    `part=statistics,snippet&id=${videoIds}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  const statsData = await statsRes.json()
  if (!statsData.items) throw new Error(`YouTube stats error: ${JSON.stringify(statsData)}`)

  const sinceMs = since ? new Date(since).getTime() : null
  const untilMs = until ? new Date(until + 'T23:59:59').getTime() : null

  let synced = 0
  for (const video of statsData.items) {
    const publishedAt: string = video.snippet?.publishedAt ?? null
    if (publishedAt) {
      const publishedMs = new Date(publishedAt).getTime()
      if (sinceMs && publishedMs < sinceMs) continue
      if (untilMs && publishedMs > untilMs) continue
    }
    const { error } = await supabase.from('post_metrics').upsert(
      {
        brand_id: brandId,
        platform: 'youtube',
        post_url: `https://www.youtube.com/watch?v=${video.id}`,
        posted_at: publishedAt ? publishedAt.slice(0, 10) : null,
        views: parseInt(video.statistics?.viewCount ?? '0') || null,
        likes: parseInt(video.statistics?.likeCount ?? '0') || null,
        comments: parseInt(video.statistics?.commentCount ?? '0') || null,
      },
      { onConflict: 'brand_id,platform,post_url', ignoreDuplicates: false },
    )
    if (!error) synced++
  }
  return synced
}
