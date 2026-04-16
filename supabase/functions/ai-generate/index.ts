// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type GenerateSource =
  | { type: 'trending_topic'; title: string; summary: string }
  | { type: 'competitor_post'; caption: string | null; hook: string | null; views: number | null; likes: number | null }
  | { type: 'manual'; brief: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseVariants(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const variants = lines
    .filter((l) => /^\d+[\.\)]/.test(l))
    .map((l) => l.replace(/^\d+[\.\)]\s*/, '').trim())
  if (variants.length >= 1) return variants.slice(0, 3)
  return [text.trim()]
}

function platformLabel(platform: string): string {
  const map: Record<string, string> = {
    instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
    facebook: 'Facebook', linkedin: 'LinkedIn',
  }
  return map[platform] ?? platform
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    hook: 'attention-grabbing opening hook',
    caption: 'engaging post caption',
    idea: 'content idea',
  }
  return map[type] ?? type
}

function fmtEngagement(source: { views: number | null; likes: number | null }): string {
  if (source.views && source.views > 0) {
    const v = source.views >= 1_000_000
      ? `${(source.views / 1_000_000).toFixed(1)}M`
      : source.views >= 1_000 ? `${Math.round(source.views / 1_000)}K` : String(source.views)
    return `${v} views`
  }
  if (source.likes && source.likes > 0) {
    const l = source.likes >= 1_000 ? `${Math.round(source.likes / 1_000)}K` : String(source.likes)
    return `${l} likes`
  }
  return 'high engagement'
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildPrompt(
  brand: { name: string; niche: string; target_location: string | null },
  type: string,
  platform: string,
  tone: string,
  source: GenerateSource,
  savedHooks: { text: string }[],
  topPosts: { hook: string | null; caption: string | null }[],
): string {
  const loc = brand.target_location ? ` based in ${brand.target_location}` : ''
  const plat = platformLabel(platform)
  const typeLbl = typeLabel(type)

  const voiceSection = savedHooks.length > 0
    ? `BRAND VOICE — match this style in your output:\n${savedHooks.map((h, i) => `${i + 1}. "${h.text}"`).join('\n')}\n\n`
    : ''

  const marketSection = topPosts.length > 0
    ? `WHAT'S WORKING FOR COMPETITORS — draw inspiration, do not copy:\n${topPosts.map((p, i) => `${i + 1}. ${p.hook ?? (p.caption ?? '').slice(0, 150)}`).join('\n')}\n\n`
    : ''

  const rulesSection = `Rules:
- Each variant must be unique and take a completely different angle
- Match the ${tone} tone throughout
- Optimize specifically for ${plat} (style, length, audience expectations)
- For hooks: make the first line irresistible — curiosity, controversy, or a bold claim
- For captions: include a clear call-to-action at the end
- For ideas: be specific and actionable, describe the exact format and topic
- Output ONLY the numbered list. No introductions, headings, or extra text.`

  if (source.type === 'trending_topic') {
    return `You are a social media content expert for ${brand.name}, a ${brand.niche} brand${loc}.

TRENDING TOPIC: "${source.title}"
Context: ${source.summary}

Generate exactly 3 distinct ${typeLbl}s for ${plat} in a ${tone} tone, all about this trending topic.

${voiceSection}${marketSection}${rulesSection}

1.
2.
3.`
  }

  if (source.type === 'competitor_post') {
    const postText = source.hook ?? (source.caption ?? '').slice(0, 300)
    return `You are a social media content expert for ${brand.name}, a ${brand.niche} brand${loc}.

HIGH-PERFORMING COMPETITOR POST (${fmtEngagement(source)}):
"${postText}"

Generate exactly 3 distinct ${typeLbl}s for ${plat} in a ${tone} tone.
Reimagine the concept in your brand's unique voice — same core angle, completely different execution.

${voiceSection}${rulesSection}
- DO NOT reproduce the competitor's words. Rewrite entirely in your brand voice.

1.
2.
3.`
  }

  // manual
  return `You are a social media content expert for ${brand.name}, a ${brand.niche} brand${loc}.

Generate exactly 3 distinct ${typeLbl}s for ${plat} in a ${tone} tone.
Brief: ${source.brief}

${voiceSection}${rulesSection}

1.
2.
3.`
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    if (!GOOGLE_AI_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'GOOGLE_AI_API_KEY secret is not set. Go to Supabase Dashboard → Edge Functions → Manage secrets.',
        }),
        { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const { brand_id, type, platform, tone, source } = await req.json() as {
      brand_id: string
      type: string
      platform: string
      tone: string
      source: GenerateSource
    }

    if (!brand_id || !type || !platform || !tone || !source) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: brand_id, type, platform, tone, source' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Fetch brand, saved hooks, and top competitor posts in parallel
    const [brandRes, hooksRes, postsRes] = await Promise.all([
      supabase.from('brand_profiles').select('name, niche, target_location').eq('id', brand_id).single(),
      supabase.from('saved_hooks').select('text').eq('brand_id', brand_id)
        .order('created_at', { ascending: false }).limit(5),
      supabase.from('competitor_posts').select('hook, caption, views, likes')
        .eq('brand_id', brand_id)
        .not('views', 'is', null)
        .order('views', { ascending: false })
        .limit(3),
    ])

    if (brandRes.error || !brandRes.data) {
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const brand = brandRes.data
    const savedHooks = hooksRes.data ?? []
    const topPosts = postsRes.data ?? []

    const prompt = buildPrompt(brand, type, platform, tone, source, savedHooks, topPosts)

    // Call Gemini
    const aiRes = await fetch(`${GEMINI_URL}?key=${GOOGLE_AI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 1024, topP: 0.95 },
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      throw new Error(`Gemini error (${aiRes.status}): ${errText}`)
    }

    const aiData = await aiRes.json()
    const rawText: string = aiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!rawText) throw new Error('Gemini returned an empty response')

    const output = parseVariants(rawText)

    // Brief for DB (human-readable summary of what was used)
    const brief =
      source.type === 'trending_topic'
        ? source.title
        : source.type === 'competitor_post'
        ? `Remix: ${(source.caption ?? source.hook ?? '').slice(0, 100)}`
        : source.brief

    const { data: record, error: insertError } = await supabase
      .from('generated_content')
      .insert({ brand_id, type, platform, brief, output, tone })
      .select()
      .single()

    if (insertError) throw new Error(insertError.message)

    return new Response(
      JSON.stringify({ record }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
