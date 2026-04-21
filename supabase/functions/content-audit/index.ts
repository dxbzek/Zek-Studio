// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireUser, requireBrandAccess } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

async function groq(prompt: string): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 800,
    }),
  })
  if (!res.ok) throw new Error(`Groq error (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

Deno.serve(async (req) => {
  const CORS = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY)
    const authResult = await requireUser(req, sb, CORS)
    if (authResult.error) return authResult.error

    const { brand_id, date_from, date_to, platform } = await req.json()
    if (!brand_id) {
      return new Response(JSON.stringify({ error: 'Missing required field: brand_id' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const accessResult = await requireBrandAccess(sb, brand_id, authResult.user.id, authResult.user.email, CORS)
    if (accessResult.error) return accessResult.error

    let metricsQuery = sb
      .from('post_metrics')
      .select('*')
      .eq('brand_id', brand_id)
      .not('posted_at', 'is', null)
    if (date_from) metricsQuery = metricsQuery.gte('posted_at', date_from)
    if (date_to)   metricsQuery = metricsQuery.lte('posted_at', date_to + 'T23:59:59')
    if (platform)  metricsQuery = metricsQuery.eq('platform', platform)

    const [{ data: brand }, { data: metrics }] = await Promise.all([
      sb.from('brand_profiles').select('name, niche').eq('id', brand_id).single(),
      metricsQuery,
    ])

    if (!metrics || metrics.length < 3) {
      return new Response(
        JSON.stringify({ error: 'Not enough data — log at least 3 posts first' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // Build per-platform averages
    const byPlatform: Record<string, { totalViews: number; totalLikes: number; count: number }> = {}
    for (const m of metrics) {
      if (!byPlatform[m.platform]) byPlatform[m.platform] = { totalViews: 0, totalLikes: 0, count: 0 }
      byPlatform[m.platform].totalViews += m.views ?? 0
      byPlatform[m.platform].totalLikes += m.likes ?? 0
      byPlatform[m.platform].count++
    }
    const platformStats = Object.entries(byPlatform).map(([platform, s]) => ({
      platform,
      posts: s.count,
      avg_views: Math.round(s.totalViews / s.count),
      avg_likes: Math.round(s.totalLikes / s.count),
    }))

    const topPost = [...metrics].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0]
    const summary = {
      brand: brand?.name,
      niche: brand?.niche,
      total_posts: metrics.length,
      platforms_used: platformStats,
      top_post: {
        platform: topPost.platform,
        views: topPost.views,
        likes: topPost.likes,
        posted_at: topPost.posted_at,
      },
    }

    const dateRange = date_from || date_to
      ? ` (filtered: ${date_from ?? 'start'} to ${date_to ?? 'today'}${platform ? `, ${platform} only` : ''})`
      : ''

    const prompt = `You are analyzing social media performance for ${brand?.name}, a ${brand?.niche} brand${dateRange}.

PERFORMANCE DATA:
${JSON.stringify(summary, null, 2)}

Return exactly 4 specific, data-driven insights as a JSON array. Each object must have:
- "category": one of "Engagement", "Reach", "Posting Strategy", "Platform Mix"
- "text": the insight referencing actual numbers + a clear recommendation

Output ONLY valid JSON, no markdown, no explanation:
[{"category":"...","text":"..."},...]`

    const text = await groq(prompt)

    let insights: { category: string; text: string }[] = []
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) insights = JSON.parse(jsonMatch[0])
    } catch {
      // fallback: parse numbered lines as plain text
      insights = text
        .split('\n')
        .filter((l: string) => /^\d+\./.test(l.trim()))
        .slice(0, 4)
        .map((l: string, idx: number) => ({
          category: ['Engagement', 'Reach', 'Posting Strategy', 'Platform Mix'][idx] ?? 'General',
          text: l.replace(/^\d+\.\s*/, '').trim(),
        }))
    }

    return new Response(JSON.stringify({ insights }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
