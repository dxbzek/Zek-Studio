// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APIFY_TOKEN = Deno.env.get('APIFY_API_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ACTORS: Record<string, string> = {
  instagram: 'apify/instagram-scraper',
  tiktok: 'clockworks/tiktok-scraper',
  facebook: 'apify/facebook-pages-scraper',
  youtube: 'streamers/youtube-scraper',
}

function extractUsername(input: string): string {
  const trimmed = input.trim()
  try {
    if (trimmed.startsWith('http')) {
      const url = new URL(trimmed)
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length > 0) return parts[0].replace(/^@/, '')
    }
  } catch { /* not a URL */ }
  return trimmed.replace(/^@/, '')
}

function buildApifyInput(platform: string, handle: string, since?: string, until?: string): unknown {
  const clean = extractUsername(handle)
  switch (platform) {
    case 'instagram':
      return {
        directUrls: [`https://www.instagram.com/${clean}/`],
        resultsType: 'posts',
        resultsLimit: 50,
        ...(since ? { onlyPostsNewerThan: since } : {}),
        ...(until ? { onlyPostsOlderThan: until } : {}),
      }
    case 'tiktok':
      return { profiles: [`@${clean}`], resultsPerPage: 50 }
    case 'facebook':
      return { startUrls: [{ url: `https://www.facebook.com/${clean}` }], maxPosts: 50 }
    case 'youtube':
      return { startUrls: [{ url: `https://www.youtube.com/@${clean}` }], maxResultsShorts: 0, maxResults: 50 }
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}

function nonNeg(v: number | null): number | null {
  return v !== null && v >= 0 ? v : null
}

function extractFollowers(platform: string, rawItems: Record<string, any>[]): number | null {
  if (rawItems.length === 0) return null
  for (const raw of rawItems.slice(0, 5)) {
    switch (platform) {
      case 'instagram':
        if (raw.followersCount != null) return Number(raw.followersCount)
        if (raw.owner?.edge_followed_by?.count != null) return Number(raw.owner.edge_followed_by.count)
        break
      case 'tiktok':
        if (raw.authorMeta?.fans != null) return Number(raw.authorMeta.fans)
        if (raw.author?.followers_count != null) return Number(raw.author.followers_count)
        break
      case 'facebook':
        if (raw.pageInfo?.likes != null) return Number(raw.pageInfo.likes)
        if (raw.fanCount != null) return Number(raw.fanCount)
        if (raw.fans != null) return Number(raw.fans)
        break
      case 'youtube':
        if (raw.numberOfSubscribers != null) {
          const n = parseInt(String(raw.numberOfSubscribers).replace(/[^0-9]/g, ''))
          if (!isNaN(n) && n > 0) return n
        }
        if (raw.channelStats?.subscriberCount != null) return Number(raw.channelStats.subscriberCount)
        break
    }
  }
  return null
}

function normalizeToMetric(
  platform: string,
  raw: Record<string, any>,
  brandId: string,
): Record<string, any> | null {
  let post_url: string | null = null
  let posted_at: string | null = null
  let posted_time: string | null = null
  let views: number | null = null
  let likes: number | null = null
  let comments: number | null = null
  let shares: number | null = null

  switch (platform) {
    case 'instagram':
      post_url   = raw.url ?? null
      if (raw.timestamp) {
        posted_at  = String(raw.timestamp).slice(0, 10)
        posted_time = String(raw.timestamp).slice(11, 16) || null
      }
      views    = nonNeg(raw.videoViewCount ?? raw.videoPlayCount ?? null)
      likes    = nonNeg(raw.likesCount ?? null)
      comments = nonNeg(raw.commentsCount ?? null)
      break
    case 'tiktok':
      post_url  = raw.webVideoUrl ?? null
      if (raw.createTime) {
        const d = new Date(raw.createTime * 1000)
        posted_at  = d.toISOString().slice(0, 10)
        posted_time = d.toISOString().slice(11, 16)
      }
      views    = nonNeg(raw.playCount ?? null)
      likes    = nonNeg(raw.diggCount ?? null)
      comments = nonNeg(raw.commentCount ?? null)
      shares   = nonNeg(raw.shareCount ?? null)
      break
    case 'facebook':
      post_url = raw.postUrl ?? raw.url ?? raw.facebookUrl ?? null
      if (raw.date) {
        posted_at = String(raw.date).slice(0, 10)
      } else if (raw.time) {
        const t = Number(raw.time)
        if (!isNaN(t) && t > 1_000_000_000) {
          const d = new Date(t * 1000)
          posted_at  = d.toISOString().slice(0, 10)
          posted_time = d.toISOString().slice(11, 16)
        } else {
          posted_at = String(raw.time).slice(0, 10)
        }
      }
      likes    = nonNeg(raw.reactionsCount ?? raw.likesCount ?? raw.likes ?? null)
      comments = nonNeg(raw.commentsCount ?? raw.comments ?? null)
      shares   = nonNeg(raw.sharesCount ?? raw.shares ?? null)
      break
    case 'youtube':
      post_url  = raw.url ?? raw.id ? `https://www.youtube.com/watch?v=${raw.id}` : null
      {
        const yt_date = raw.date ?? raw.publishedAt ?? null
        if (yt_date) {
          posted_at   = String(yt_date).slice(0, 10)
          posted_time = String(yt_date).slice(11, 16) || null
        }
      }
      views    = nonNeg(raw.viewCount   ? parseInt(raw.viewCount)   : null)
      likes    = nonNeg(raw.likes       ? parseInt(raw.likes)       : raw.likeCount ? parseInt(raw.likeCount) : null)
      comments = nonNeg(raw.commentsCount ? parseInt(raw.commentsCount) : raw.commentCount ? parseInt(raw.commentCount) : null)
      break
    default:
      return null
  }

  if (!post_url) return null // can't upsert without a URL

  return {
    brand_id: brandId,
    platform,
    post_url,
    posted_at,
    posted_time,
    views,
    likes,
    comments,
    shares,
    saves: null,
    reach: null,
    impressions: null,
    notes: null,
    calendar_entry_id: null,
    logged_by: null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    if (!APIFY_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'APIFY_API_TOKEN not set in Supabase secrets' }),
        { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    // Validate caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { brand_id, platform, since, until } = await req.json() as {
      brand_id: string
      platform: string
      since?: string  // ISO date e.g. "2024-01-01"
      until?: string  // ISO date e.g. "2024-03-31"
    }
    if (!brand_id || !platform) {
      return new Response(JSON.stringify({ error: 'brand_id and platform are required' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (!ACTORS[platform]) {
      return new Response(
        JSON.stringify({ error: `Platform "${platform}" is not supported for sync` }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // Verify ownership and get handle
    const { data: brand, error: brandError } = await supabase
      .from('brand_profiles')
      .select('id, instagram_handle, tiktok_handle, facebook_handle, youtube_handle')
      .eq('id', brand_id)
      .eq('user_id', user.id)
      .single()

    if (brandError || !brand) {
      return new Response(JSON.stringify({ error: 'Brand not found or access denied' }), {
        status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const handleField = `${platform}_handle` as keyof typeof brand
    const handle = brand[handleField] as string | null
    if (!handle) {
      return new Response(
        JSON.stringify({ error: `No ${platform} handle configured for this brand. Edit the brand and add the handle.` }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // Run Apify actor
    const input = buildApifyInput(platform, handle, since, until)
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(ACTORS[platform])}/runs?waitForFinish=90&token=${APIFY_TOKEN}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
    )
    if (!runRes.ok) throw new Error(`Apify error (${runRes.status}): ${await runRes.text()}`)

    const runData = await runRes.json()
    let run = runData.data

    // Poll if still running (free Apify accounts can be slow to start)
    if (run.status === 'READY' || run.status === 'RUNNING') {
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 5000))
        const poll = await fetch(`https://api.apify.com/v2/actor-runs/${run.id}?token=${APIFY_TOKEN}`)
        if (poll.ok) run = (await poll.json()).data
        if (run.status !== 'READY' && run.status !== 'RUNNING') break
      }
    }

    if (run.status !== 'SUCCEEDED') {
      throw new Error(`Apify run ended with status "${run.status}": ${run.statusMessage ?? ''}`)
    }

    // Fetch dataset items
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=100&clean=true`,
    )
    if (!itemsRes.ok) throw new Error('Failed to fetch Apify results')
    const rawPosts: Record<string, any>[] = await itemsRes.json()

    // Upsert into post_metrics
    let synced = 0
    for (const raw of rawPosts) {
      const metric = normalizeToMetric(platform, raw, brand_id)
      if (!metric) continue

      // Apply date range filter (for platforms without native Apify date support)
      if (metric.posted_at) {
        if (since && metric.posted_at < since) continue
        if (until && metric.posted_at > until) continue
      }

      const { error } = await supabase
        .from('post_metrics')
        .upsert(metric, { onConflict: 'brand_id,platform,post_url', ignoreDuplicates: false })
      if (!error) synced++
    }

    // Capture follower snapshot for today
    const followerCount = extractFollowers(platform, rawPosts)
    if (followerCount !== null && followerCount > 0) {
      const today = new Date().toISOString().slice(0, 10)
      await supabase.from('growth_snapshots').upsert(
        { brand_id, platform, followers: followerCount, recorded_at: today },
        { onConflict: 'brand_id,platform,recorded_at', ignoreDuplicates: true },
      )
    }

    return new Response(JSON.stringify({ synced }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('sync-brand-analytics error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
