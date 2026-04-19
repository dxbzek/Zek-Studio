// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user } } = await sb.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const { brand_id } = await req.json()
    const [{ data: brand }, { data: metrics }] = await Promise.all([
      sb.from('brand_profiles').select('name, niche').eq('id', brand_id).single(),
      sb.from('post_metrics').select('*').eq('brand_id', brand_id).not('posted_at', 'is', null),
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

    const prompt = `You are analyzing social media performance for ${brand?.name}, a ${brand?.niche} brand.

PERFORMANCE DATA:
${JSON.stringify(summary, null, 2)}

Write exactly 4 specific, data-driven insights. Each insight must:
1. Reference actual numbers from the data
2. End with a clear recommendation

Format as a numbered list:
1. [insight + recommendation]
2. [insight + recommendation]
3. [insight + recommendation]
4. [insight + recommendation]

Only output the 4 numbered insights. No intro or conclusion.`

    const text = await groq(prompt)

    const insights = text
      .split('\n')
      .filter((l: string) => /^\d+\./.test(l.trim()))
      .map((l: string) => l.replace(/^\d+\.\s*/, '').trim())
      .slice(0, 4)

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
