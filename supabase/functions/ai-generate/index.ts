// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function groq(prompt: string): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      max_tokens: 1024,
    }),
  })
  if (!res.ok) throw new Error(`Groq error (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// ─── Types ────────────────────────────────────────────────────────────────────

type GenerateSource =
  | { type: 'trending_topic'; title: string; summary: string }
  | { type: 'competitor_post'; caption: string | null; hook: string | null; views: number | null; likes: number | null }
  | { type: 'manual'; brief: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseVariants(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const numbered = lines
    .filter((l) => /^\d+[\.\)]/.test(l))
    .map((l) => l.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(Boolean)
  if (numbered.length >= 1) return numbered.slice(0, 3)
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  if (paragraphs.length >= 2) return paragraphs.slice(0, 3)
  return [text.trim()]
}

function platformLabel(platform: string): string {
  const map: Record<string, string> = {
    meta: 'Instagram and Facebook (Meta)',
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
    script: 'short-form video script (Reel/TikTok)',
    listing: 'property spotlight post',
    market: 'market update post',
    story: 'personal story post',
    cta: 'call-to-action post',
  }
  return map[type] ?? type
}

function typeInstructions(type: string): string {
  const map: Record<string, string> = {
    hook: 'Make the first line irresistible — curiosity, a bold claim, or a surprising fact. No intro.',
    caption: 'Include a clear call-to-action at the end. Use line breaks for readability.',
    idea: 'Be specific and actionable — describe the exact format, topic, and angle.',
    script: 'Open with a hook (first 2 seconds), then deliver value, end with CTA. Use natural spoken language. Format as: HOOK: / BODY: / CTA:',
    listing: 'Lead with the most compelling property detail. Include location, key features, price range hint if relevant, end with CTA (DM/link in bio).',
    market: 'Lead with a specific data point or trend. Explain what it means for buyers/investors. Keep it authoritative but accessible.',
    story: 'Start in the middle of the action. Make it relatable. End with a lesson or CTA. First person perspective.',
    cta: 'One clear ask. Create urgency or curiosity. Short and punchy. No more than 3 sentences.',
  }
  return map[type] ?? 'Make it compelling and platform-native.'
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
  seoKeywords: { keyword: string; intent: string | null }[],
): string {
  const loc = brand.target_location ? ` based in ${brand.target_location}` : ''
  const plat = platformLabel(platform)
  const typeLbl = typeLabel(type)
  const typeInstr = typeInstructions(type)

  const voiceSection = savedHooks.length > 0
    ? `BRAND VOICE — match this style:\n${savedHooks.map((h, i) => `${i + 1}. "${h.text}"`).join('\n')}\n\n`
    : ''

  const marketSection = topPosts.length > 0
    ? `TOP COMPETITOR CONTENT — draw inspiration, do not copy:\n${topPosts.map((p, i) => `${i + 1}. ${p.hook ?? (p.caption ?? '').slice(0, 150)}`).join('\n')}\n\n`
    : ''

  const kwSection = seoKeywords.length > 0
    ? `TARGET KEYWORDS — weave naturally where relevant:\n${seoKeywords.map((k) => `• ${k.keyword}${k.intent ? ` (${k.intent})` : ''}`).join('\n')}\n\n`
    : ''

  const rulesSection = `Rules:
- Each variant must be unique and take a completely different angle
- Match the ${tone} tone throughout
- Optimize specifically for ${plat} (style, length, audience expectations)
- ${typeInstr}
- Output ONLY the numbered list. No introductions, headings, or extra text.`

  if (source.type === 'trending_topic') {
    return `You are a social media content expert for ${brand.name}, a ${brand.niche} brand${loc}.

TRENDING TOPIC: "${source.title}"
Context: ${source.summary}

Generate exactly 3 distinct ${typeLbl}s for ${plat} in a ${tone} tone, all about this trending topic.

${voiceSection}${marketSection}${kwSection}${rulesSection}

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

${voiceSection}${kwSection}${rulesSection}
- DO NOT reproduce the competitor's words. Rewrite entirely in your brand voice.

1.
2.
3.`
  }

  // manual
  return `You are a social media content expert for ${brand.name}, a ${brand.niche} brand${loc}.

Generate exactly 3 distinct ${typeLbl}s for ${plat} in a ${tone} tone.
Brief: ${source.brief}

${voiceSection}${kwSection}${rulesSection}

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
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'GROQ_API_KEY secret is not set. Go to Supabase Dashboard → Edge Functions → Manage secrets.',
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

    // Fetch brand, saved hooks, top competitor posts, and SEO keywords in parallel
    const [brandRes, hooksRes, postsRes, kwRes] = await Promise.all([
      supabase.from('brand_profiles').select('name, niche, target_location').eq('id', brand_id).single(),
      supabase.from('saved_hooks').select('text').eq('brand_id', brand_id)
        .order('created_at', { ascending: false }).limit(5),
      supabase.from('competitor_posts').select('hook, caption, views, likes')
        .eq('brand_id', brand_id)
        .not('views', 'is', null)
        .order('views', { ascending: false })
        .limit(3),
      supabase.from('seo_keywords').select('keyword, intent')
        .eq('brand_id', brand_id)
        .neq('status', 'targeting')
        .limit(8),
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
    const seoKeywords = kwRes.data ?? []

    const prompt = buildPrompt(brand, type, platform, tone, source, savedHooks, topPosts, seoKeywords)
    const rawText = await groq(prompt)
    if (!rawText) throw new Error('Groq returned an empty response')

    const output = parseVariants(rawText)

    const brief =
      source.type === 'trending_topic'
        ? source.title
        : source.type === 'competitor_post'
        ? `Remix: ${(source.caption ?? source.hook ?? '').slice(0, 100)}`
        : source.brief

    // Map meta platform back to instagram for storage
    const storedPlatform = platform === 'meta' ? 'instagram' : platform

    const { data: record, error: insertError } = await supabase
      .from('generated_content')
      .insert({ brand_id, type, platform: storedPlatform, brief, output, tone })
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
