// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireUser, requireBrandAccess } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'

const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY')
const APIFY_TOKEN = Deno.env.get('APIFY_API_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000 // posts no older than 90 days
const MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000  // posts at least 7 days old (let engagement accumulate)

// ─── Tavily ───────────────────────────────────────────────────────────────────

async function tavilySearch(query: string, maxResults = 10): Promise<any[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: false,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Tavily error (${res.status}): ${err}`)
  }
  const data = await res.json()
  return data.results ?? []
}

// ─── Apify ────────────────────────────────────────────────────────────────────

/** Run an Apify actor and wait up to totalTimeoutMs total before giving up */
async function apifyRun(actorId: string, input: unknown, totalTimeoutMs = 30_000): Promise<any[]> {
  if (!APIFY_TOKEN) return []

  const deadline = Date.now() + totalTimeoutMs

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?waitForFinish=20&token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  if (!runRes.ok) return []

  const runData = await runRes.json()
  let run = runData.data

  // Poll if still queued / running (up to remaining budget)
  while ((run.status === 'READY' || run.status === 'RUNNING') && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000))
    if (Date.now() >= deadline) break
    const pollRes = await fetch(`https://api.apify.com/v2/actor-runs/${run.id}?token=${APIFY_TOKEN}`)
    if (pollRes.ok) {
      const pollData = await pollRes.json()
      run = pollData.data
    }
  }

  if (run.status !== 'SUCCEEDED') return []

  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=60&clean=true`,
  )
  if (!itemsRes.ok) return []

  return await itemsRes.json()
}

// ─── Hashtag derivation ───────────────────────────────────────────────────────

function deriveHashtags(niche: string, location: string | null): string[] {
  const nicheWords = niche
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const locWords = location
    ? location
        .toLowerCase()
        .replace(/[^a-z0-9\s,]/g, '')
        .split(/[\s,]+/)
        .filter((w) => w.length > 2)
        .slice(0, 2)
    : []

  const nicheSlug = nicheWords.join('') // "realestate"
  const tags: string[] = [nicheSlug]

  if (locWords.length > 0) {
    tags.push(locWords[0] + nicheSlug) // "dubairealstate"
    tags.push(nicheSlug + locWords[0]) // "realestatedubai"
    tags.push(locWords[0]) // "dubai"
  }

  // add individual niche words longer than 4 chars (e.g. "estate", "luxury")
  nicheWords.filter((w) => w.length > 4).forEach((w) => tags.push(w))

  return [...new Set(tags)].slice(0, 5)
}

// ─── Creator extraction from hashtag posts ───────────────────────────────────

function creatorsFromPosts(posts: any[], platform: 'instagram' | 'tiktok'): any[] {
  type CreatorEntry = {
    handle: string
    name: string
    topViews: number
    topLikes: number
    topPostUrl: string | null
    topPostDate: string | null
  }

  const byHandle = new Map<string, CreatorEntry>()

  for (const post of posts) {
    // Resolve fields per platform
    const handle = platform === 'instagram'
      ? (post.ownerUsername ?? post.username ?? null)
      : (post.authorMeta?.name ?? post.author ?? null)
    if (!handle) continue

    // Recency filter: keep posts between 7 days and 90 days old
    const rawTs = platform === 'instagram'
      ? post.timestamp
      : post.createTime ? new Date(post.createTime * 1000).toISOString() : null
    if (rawTs) {
      const ts = new Date(rawTs).getTime()
      if (!isNaN(ts)) {
        const age = Date.now() - ts
        if (age < MIN_AGE_MS || age > MAX_AGE_MS) continue
      }
    }

    const views = platform === 'instagram'
      ? (post.videoViewCount ?? post.videoPlayCount ?? 0)
      : (post.playCount ?? 0)
    const likes = platform === 'instagram'
      ? (post.likesCount ?? 0)
      : (post.diggCount ?? 0)
    const postUrl = platform === 'instagram'
      ? (post.url ?? `https://www.instagram.com/${handle}/`)
      : (post.webVideoUrl ?? null)
    const postDate = rawTs ?? null
    const displayName = platform === 'instagram'
      ? (post.ownerFullName ?? post.fullName ?? handle)
      : (post.authorMeta?.nickName ?? handle)

    // Score: views preferred; weighted likes as fallback
    const score = views > 0 ? views : likes * 10

    const existing = byHandle.get(handle)
    const existingScore = existing
      ? (existing.topViews > 0 ? existing.topViews : existing.topLikes * 10)
      : -1

    if (!existing || score > existingScore) {
      byHandle.set(handle, {
        handle,
        name: displayName,
        topViews: views,
        topLikes: likes,
        topPostUrl: postUrl,
        topPostDate: postDate,
      })
    }
  }

  return Array.from(byHandle.values())
    .sort((a, b) => {
      const scoreA = a.topViews > 0 ? a.topViews : a.topLikes * 10
      const scoreB = b.topViews > 0 ? b.topViews : b.topLikes * 10
      return scoreB - scoreA
    })
    .slice(0, 12)
    .map((c) => ({
      name: c.name,
      handle: c.handle,
      platform,
      bio: null,
      estimated_followers: null,
      url: platform === 'instagram'
        ? `https://www.instagram.com/${c.handle}/`
        : `https://www.tiktok.com/@${c.handle}`,
      top_post_views: c.topViews > 0 ? c.topViews : null,
      top_post_likes: c.topLikes > 0 ? c.topLikes : null,
      top_post_url: c.topPostUrl,
      top_post_date: c.topPostDate,
    }))
}

// ─── Tavily creator fallback (when Apify not configured) ─────────────────────

function extractCreator(result: any, platform: 'instagram' | 'tiktok' | 'youtube'): any | null {
  const url: string = result.url ?? ''
  let handle: string | null = null

  if (platform === 'instagram') {
    const m = url.match(/instagram\.com\/([^/?#]+)/)
    if (m && !['p', 'explore', 'stories', 'reels', 'tv', 'accounts'].includes(m[1])) handle = m[1]
  } else if (platform === 'tiktok') {
    const m = url.match(/tiktok\.com\/@([^/?#]+)/)
    if (m) handle = m[1]
  } else if (platform === 'youtube') {
    const m = url.match(/youtube\.com\/@([^/?#]+)/)
    if (m) handle = m[1]
  }

  if (!handle) return null

  return {
    name: result.title.split(' - ')[0].split(' | ')[0].trim(),
    handle,
    platform,
    bio: result.content?.slice(0, 150) ?? null,
    estimated_followers: null,
    url,
    top_post_views: null,
    top_post_likes: null,
    top_post_url: null,
    top_post_date: null,
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const CORS_HEADERS = corsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    if (!TAVILY_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'TAVILY_API_KEY secret is not set. Go to Supabase Dashboard → Edge Functions → Manage secrets and add it.',
        }),
        { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const { brand_id, niche, location } = await req.json()

    if (!brand_id || !niche) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: brand_id, niche' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const authResult = await requireUser(req, supabase, CORS_HEADERS)
    if (authResult.error) return authResult.error
    const accessResult = await requireBrandAccess(supabase, brand_id, authResult.user.id, authResult.user.email, CORS_HEADERS)
    if (accessResult.error) return accessResult.error

    const loc = location?.trim() || null
    const cacheKey = `${niche.toLowerCase().trim()}${loc ? `:${loc.toLowerCase()}` : ''}`

    // Check cache
    const { data: cached } = await supabase
      .from('niche_research_cache')
      .select('*')
      .eq('brand_id', brand_id)
      .eq('query', cacheKey)
      .maybeSingle()

    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime()
      if (age < CACHE_TTL_MS) {
        return new Response(
          JSON.stringify({ results: cached.results, cached: true }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }
    }

    const year = new Date().getFullYear()
    const locStr = loc ? ` in ${loc}` : ''
    const hashtags = deriveHashtags(niche, loc)

    // Run in parallel: Tavily topics + Apify IG hashtag + Apify TT hashtag
    // 30s total budget per Apify call — if they don't finish, fall back to Tavily
    const [topicsResults, igPosts, ttPosts] = await Promise.all([
      tavilySearch(`${niche}${locStr} market trends news insights ${year}`, 8),
      apifyRun('apify/instagram-hashtag-scraper', { hashtags, resultsLimit: 50 }, 30_000),
      apifyRun('clockworks/tiktok-scraper', { hashtags: hashtags.slice(0, 3), resultsPerPage: 20 }, 30_000),
    ])

    const trending_topics = topicsResults.map((r: any) => ({
      title: r.title,
      summary: (r.content ?? '').slice(0, 250),
      url: r.url,
      source: (() => {
        try { return new URL(r.url).hostname.replace('www.', '') } catch { return r.url }
      })(),
      published_at: r.published_date ?? null,
    }))

    // Build creator list from hashtag post data, ranked by engagement
    const igCreators = creatorsFromPosts(igPosts, 'instagram')
    const ttCreators = creatorsFromPosts(ttPosts, 'tiktok')

    const seen = new Set<string>()
    const top_creators: any[] = [...igCreators, ...ttCreators].filter((c) => {
      const key = `${c.platform}:${c.handle}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Fall back to Tavily creator search if Apify is not configured or returned nothing
    if (top_creators.length === 0) {
      const locLabel = loc || 'Dubai UAE'
      const [igFallback, ttFallback, ytFallback] = await Promise.all([
        tavilySearch(`${niche} creator based in ${locLabel} instagram ${year} site:instagram.com`, 10),
        tavilySearch(`${niche} creator based in ${locLabel} tiktok ${year} site:tiktok.com`, 8),
        tavilySearch(`${niche} ${locLabel} youtube channel ${year} site:youtube.com`, 6),
      ])

      const fallbackSeen = new Set<string>()
      for (const [results, platform] of [
        [igFallback, 'instagram' as const],
        [ttFallback, 'tiktok' as const],
        [ytFallback, 'youtube' as const],
      ] as [any[], 'instagram' | 'tiktok' | 'youtube'][]) {
        for (const r of results) {
          const creator = extractCreator(r, platform)
          if (!creator) continue
          const key = `${creator.platform}:${creator.handle}`
          if (fallbackSeen.has(key)) continue
          fallbackSeen.add(key)
          top_creators.push(creator)
        }
      }
    }

    const results = { trending_topics, top_creators }

    // Upsert cache
    await supabase
      .from('niche_research_cache')
      .upsert(
        { brand_id, query: cacheKey, results, fetched_at: new Date().toISOString() },
        { onConflict: 'brand_id,query' },
      )

    return new Response(
      JSON.stringify({ results, cached: false }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
