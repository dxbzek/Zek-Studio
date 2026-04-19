// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APIFY_TOKEN = Deno.env.get('APIFY_API_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ACTORS: Record<string, string> = {
  instagram: 'apify/instagram-scraper',
  tiktok: 'clockworks/tiktok-scraper',
  facebook: 'apify/facebook-pages-scraper',
  youtube: 'apify/youtube-scraper',
}

/** Extract bare username from a handle or profile URL */
function extractUsername(input: string): string {
  const trimmed = input.trim()
  try {
    if (trimmed.startsWith('http')) {
      const url = new URL(trimmed)
      // pathname: /username or /@username or /channel/UCxxx — take first segment
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
      return {
        directUrls: [`https://www.instagram.com/${clean}/`],
        resultsType: 'posts',
        resultsLimit: 10,
      }
    case 'tiktok':
      return { profiles: [`@${clean}`], resultsPerPage: 10 }
    case 'facebook':
      return { startUrls: [{ url: `https://www.facebook.com/${clean}` }] }
    case 'youtube':
      return { startUrls: [{ url: `https://www.youtube.com/@${clean}` }], maxResults: 10 }
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}

function normalizePost(platform: string, raw: Record<string, any>) {
  switch (platform) {
    case 'instagram': {
      const caption: string | null = raw.caption ?? null
      const hook = caption?.split('\n').find((l: string) => l.trim()) ?? null
      return {
        url: raw.url ?? null,
        caption,
        views: raw.videoViewCount ?? raw.videoPlayCount ?? null,
        likes: raw.likesCount ?? null,
        comments: raw.commentsCount ?? null,
        shares: null,
        hook,
        thumbnail_url: raw.displayUrl ?? raw.thumbnailSrc ?? raw.images?.[0]?.url ?? null,
        video_url: raw.videoUrl ?? null,
        posted_at: raw.timestamp ?? null,
      }
    }
    case 'tiktok': {
      const caption: string | null = raw.text ?? null
      const hook = caption?.split('\n').find((l: string) => l.trim()) ?? null
      return {
        url: raw.webVideoUrl ?? null,
        caption,
        views: raw.playCount ?? null,
        likes: raw.diggCount ?? null,
        comments: raw.commentCount ?? null,
        shares: raw.shareCount ?? null,
        hook,
        thumbnail_url: raw.videoMeta?.coverUrl ?? null,
        video_url: raw.videoMeta?.downloadAddr ?? raw.videoUrl ?? null,
        posted_at: raw.createTime ? new Date(raw.createTime * 1000).toISOString() : null,
      }
    }
    case 'facebook':
      return {
        url: raw.url ?? null,
        caption: raw.text ?? raw.message ?? null,
        views: null,
        likes: raw.likes ?? null,
        comments: raw.comments ?? null,
        shares: raw.shares ?? null,
        hook: null,
        thumbnail_url: null,
        video_url: raw.videoUrl ?? null,
        posted_at: raw.time ?? null,
      }
    case 'youtube':
      return {
        url: raw.url ?? null,
        caption: raw.description ?? null,
        views: raw.viewCount ? parseInt(raw.viewCount) : null,
        likes: raw.likeCount ? parseInt(raw.likeCount) : null,
        comments: raw.commentCount ? parseInt(raw.commentCount) : null,
        shares: null,
        hook: raw.title ?? null,
        thumbnail_url: raw.thumbnailUrl ?? null,
        video_url: null,
        posted_at: raw.publishedAt ?? null,
      }
    default:
      return {
        url: null, caption: null, views: null, likes: null,
        comments: null, shares: null, hook: null,
        thumbnail_url: null, video_url: null, posted_at: null,
      }
  }
}

async function storeThumbnail(
  supabase: any,
  thumbnailUrl: string,
  competitorId: string,
  index: number,
): Promise<string | null> {
  try {
    const res = await fetch(thumbnailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.instagram.com/',
      },
    })
    if (!res.ok) return null

    const buffer = await res.arrayBuffer()
    const path = `${competitorId}/${index}.jpg`

    const { error } = await supabase.storage
      .from('competitor-thumbnails')
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })

    if (error) return null

    const { data } = supabase.storage
      .from('competitor-thumbnails')
      .getPublicUrl(path)

    return data.publicUrl
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    if (!APIFY_TOKEN) {
      return new Response(
        JSON.stringify({
          error: 'APIFY_API_TOKEN secret is not set. Go to Supabase Dashboard → Edge Functions → Manage secrets and add it.',
        }),
        { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const { brand_id, handle, platform } = await req.json()

    if (!brand_id || !handle || !platform) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: brand_id, handle, platform' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    if (!ACTORS[platform]) {
      return new Response(
        JSON.stringify({ error: `Platform "${platform}" is not supported for scraping` }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Upsert competitor record (unique on brand_id, handle, platform)
    const cleanHandle = extractUsername(handle)
    const { data: competitor, error: competitorError } = await supabase
      .from('competitors')
      .upsert(
        { brand_id, handle: cleanHandle, platform },
        { onConflict: 'brand_id,handle,platform' },
      )
      .select()
      .single()

    if (competitorError) throw new Error(competitorError.message)

    // Run Apify actor — waitForFinish=90 blocks up to 90s then returns run status
    const actorId = ACTORS[platform]
    const input = buildApifyInput(platform, cleanHandle)

    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?waitForFinish=90&token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    )

    if (!runRes.ok) {
      const errText = await runRes.text()
      throw new Error(`Apify error (${runRes.status}): ${errText}`)
    }

    const runData = await runRes.json()
    let run = runData.data

    // Poll if still queued/running after initial wait (free accounts can be slow to start)
    if (run.status === 'READY' || run.status === 'RUNNING') {
      const runId = run.id
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 5000))
        const pollRes = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`,
        )
        if (pollRes.ok) {
          const pollData = await pollRes.json()
          run = pollData.data
        }
        if (run.status !== 'READY' && run.status !== 'RUNNING') break
      }
    }

    if (run.status !== 'SUCCEEDED') {
      throw new Error(
        `Apify run ended with status "${run.status}": ${run.statusMessage ?? 'No details'}`,
      )
    }

    // Fetch dataset items
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=10&clean=true`,
    )

    if (!itemsRes.ok) throw new Error('Failed to fetch Apify dataset items')

    const rawPosts: Record<string, any>[] = await itemsRes.json()

    // Normalize posts and store thumbnails in Supabase Storage
    const posts = await Promise.all(
      rawPosts.slice(0, 10).map(async (raw, index) => {
        const normalized = normalizePost(platform, raw)
        if (normalized.thumbnail_url) {
          const stored = await storeThumbnail(supabase, normalized.thumbnail_url, competitor.id, index)
          if (stored) normalized.thumbnail_url = stored
        }
        return {
          ...normalized,
          competitor_id: competitor.id,
          brand_id,
          platform,
        }
      })
    )

    // Replace old posts for this competitor
    await supabase.from('competitor_posts').delete().eq('competitor_id', competitor.id)

    const { data: insertedPosts, error: postsError } = await supabase
      .from('competitor_posts')
      .insert(posts)
      .select()

    if (postsError) throw new Error(postsError.message)

    // Stamp last_scraped_at
    await supabase
      .from('competitors')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('id', competitor.id)

    return new Response(
      JSON.stringify({ competitor, posts: insertedPosts }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
