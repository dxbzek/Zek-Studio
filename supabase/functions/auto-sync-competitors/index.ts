// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APIFY_TOKEN  = Deno.env.get('APIFY_API_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ACTORS: Record<string, string> = {
  instagram: 'apify/instagram-scraper',
  tiktok:    'clockworks/tiktok-scraper',
  facebook:  'apify/facebook-pages-scraper',
  youtube:   'apify/youtube-scraper',
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

function buildApifyInput(platform: string, handle: string): unknown {
  const clean = extractUsername(handle)
  switch (platform) {
    case 'instagram':
      return { directUrls: [`https://www.instagram.com/${clean}/`], resultsType: 'posts', resultsLimit: 10 }
    case 'tiktok':
      return { profiles: [`@${clean}`], resultsPerPage: 10 }
    case 'facebook':
      return { startUrls: [{ url: `https://www.facebook.com/${clean}` }] }
    case 'youtube':
      return { startUrls: [{ url: `https://www.youtube.com/@${clean}` }], maxResultsShorts: 0, maxResults: 10 }
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}

function normalizePost(platform: string, raw: Record<string, any>, competitorId: string, brandId: string) {
  let url: string | null = null
  let caption: string | null = null
  let views: number | null = null
  let likes: number | null = null
  let comments: number | null = null
  let shares: number | null = null
  let hook: string | null = null
  let thumbnail_url: string | null = null
  let video_url: string | null = null
  let posted_at: string | null = null

  switch (platform) {
    case 'instagram':
      url         = raw.url ?? null
      caption     = raw.caption ?? null
      hook        = caption?.split('\n').find((l: string) => l.trim()) ?? null
      views       = raw.videoViewCount ?? raw.videoPlayCount ?? null
      likes       = raw.likesCount ?? null
      comments    = raw.commentsCount ?? null
      thumbnail_url = raw.displayUrl ?? raw.thumbnailSrc ?? raw.images?.[0]?.url ?? null
      video_url   = raw.videoUrl ?? null
      posted_at   = raw.timestamp ?? null
      break
    case 'tiktok':
      url         = raw.webVideoUrl ?? null
      caption     = raw.text ?? null
      hook        = caption?.split('\n').find((l: string) => l.trim()) ?? null
      views       = raw.playCount ?? null
      likes       = raw.diggCount ?? null
      comments    = raw.commentCount ?? null
      shares      = raw.shareCount ?? null
      thumbnail_url = raw.videoMeta?.coverUrl ?? null
      video_url   = raw.videoMeta?.downloadAddr ?? raw.videoUrl ?? null
      posted_at   = raw.createTime ? new Date(raw.createTime * 1000).toISOString() : null
      break
    case 'facebook':
      url         = raw.url ?? null
      caption     = raw.text ?? raw.message ?? null
      likes       = raw.likes ?? null
      comments    = raw.comments ?? null
      shares      = raw.shares ?? null
      video_url   = raw.videoUrl ?? null
      posted_at   = raw.time ?? null
      break
    case 'youtube':
      url         = raw.url ?? null
      caption     = raw.description ?? null
      hook        = raw.title ?? null
      views       = raw.viewCount ? parseInt(raw.viewCount) : null
      likes       = raw.likeCount ? parseInt(raw.likeCount) : null
      comments    = raw.commentCount ? parseInt(raw.commentCount) : null
      thumbnail_url = raw.thumbnailUrl ?? null
      posted_at   = raw.publishedAt ?? raw.date ?? null
      break
    default:
      return null
  }

  if (!url) return null

  return {
    competitor_id: competitorId,
    brand_id: brandId,
    platform,
    url,
    caption,
    views,
    likes,
    comments,
    shares,
    hook,
    thumbnail_url,
    video_url,
    posted_at,
  }
}

async function scrapeOne(supabase: any, competitor: any): Promise<boolean> {
  try {
    const input = buildApifyInput(competitor.platform, competitor.handle)
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(ACTORS[competitor.platform])}/runs?waitForFinish=90&token=${APIFY_TOKEN}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) },
    )
    if (!runRes.ok) return false

    const runData = await runRes.json()
    let run = runData.data

    if (run.status === 'READY' || run.status === 'RUNNING') {
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 5000))
        const poll = await fetch(`https://api.apify.com/v2/actor-runs/${run.id}?token=${APIFY_TOKEN}`)
        if (poll.ok) run = (await poll.json()).data
        if (run.status !== 'READY' && run.status !== 'RUNNING') break
      }
    }

    if (run.status !== 'SUCCEEDED') return false

    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=10&clean=true`,
    )
    const rawPosts: Record<string, any>[] = await itemsRes.json()

    await supabase.from('competitor_posts').delete().eq('competitor_id', competitor.id)

    for (const raw of rawPosts) {
      const post = normalizePost(competitor.platform, raw, competitor.id, competitor.brand_id)
      if (post) await supabase.from('competitor_posts').insert(post)
    }

    await supabase
      .from('competitors')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('id', competitor.id)

    return true
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  if (!APIFY_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'APIFY_API_TOKEN not set' }),
      { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: stale, error } = await supabase
    .from('competitors')
    .select('*')
    .or(`last_scraped_at.is.null,last_scraped_at.lt.${cutoff}`)

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  let scraped = 0, errors = 0
  for (const competitor of stale ?? []) {
    if (!ACTORS[competitor.platform]) { errors++; continue }
    const ok = await scrapeOne(supabase, competitor)
    if (ok) scraped++; else errors++
  }

  return new Response(JSON.stringify({ scraped, errors, total: (stale ?? []).length }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
})
