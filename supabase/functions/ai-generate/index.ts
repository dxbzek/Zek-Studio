// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireUser, requireBrandAccess } from '../_shared/auth.ts'

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
      max_tokens: 2000,
    }),
  })
  if (!res.ok) throw new Error(`Groq error (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// ─── Types ────────────────────────────────────────────────────────────────────

type GenerateSource =
  | { type: 'trending_topic'; title: string; summary: string }
  | { type: 'competitor_post'; caption: string | null; hook: string | null; views: number | null; likes: number | null; comments: number | null; shares: number | null; platform: string | null; transcript: string | null }
  | { type: 'manual'; brief: string }

type CompetitorBenchmark = {
  platform: string | null
  hook: string | null
  caption: string | null
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function platformLabel(platform: string): string {
  const map: Record<string, string> = {
    meta: 'Instagram and Facebook (Meta)',
    instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
    facebook: 'Facebook', linkedin: 'LinkedIn',
  }
  return map[platform] ?? platform
}

function themeLabel(theme: string): string {
  const map: Record<string, string> = {
    property_tour:     'Property Tour',
    market_update:     'Market Update',
    agent_recruitment: 'Agent Recruitment',
    client_story:      'Client Success Story',
    investment_tips:   'Investment Tips',
    behind_scenes:     'Behind the Scenes',
    new_launch:        'New Launch',
    area_spotlight:    'Area Spotlight',
  }
  return map[theme] ?? theme
}

function themeInstructions(theme: string): string {
  const map: Record<string, string> = {
    property_tour:     'Showcase a specific property. Lead with the most compelling feature — location, views, size, or unique selling point. Include price range hint if relevant. End with DM/link-in-bio CTA.',
    market_update:     'Share a specific Dubai real estate data point or market trend. Explain what it means for buyers or investors. Position the brand as a knowledgeable local expert.',
    agent_recruitment: 'Recruit talented real estate agents to join the brokerage. Highlight the opportunity, earnings potential, culture, and what makes this team different. End with apply/DM CTA.',
    client_story:      'Tell a client success story — a buyer finding their dream home, an investor closing a deal, or a family moving to Dubai. Start in the action, make it relatable, end with a lesson or CTA.',
    investment_tips:   'Educate potential investors on why Dubai real estate is a smart investment. Use specific facts, rental yields, capital growth figures, or regulatory benefits. Build authority.',
    behind_scenes:     'Show the human side of the brokerage — team moments, property viewings, office life, deal closings, or community. Authentic and relatable.',
    new_launch:        'Announce a new off-plan or pre-launch project. Lead with the most exciting feature, create FOMO, include payment plan/ROI hint if available. Strong inquiry CTA.',
    area_spotlight:    'Highlight a specific Dubai community or neighborhood. Cover lifestyle, property types, average prices, and why people love living or investing there.',
  }
  return map[theme] ?? 'Create compelling real estate content.'
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

const LABEL_PREFIX = /^(\*{1,2})?(hook|caption|script|video\s*script|cta|call\s*to\s*action)\1?\s*[:–\-]\s*/i

function stripLabel(s: string): string {
  return s.replace(LABEL_PREFIX, '').trim()
}

function fixJsonNewlines(jsonStr: string): string {
  // Escape literal newlines/tabs inside JSON string values only
  let result = ''
  let inString = false
  let escaped = false
  for (const ch of jsonStr) {
    if (escaped) { result += ch; escaped = false; continue }
    if (ch === '\\' && inString) { result += ch; escaped = true; continue }
    if (ch === '"') { result += ch; inString = !inString; continue }
    if (inString && ch === '\n') { result += '\\n'; continue }
    if (inString && ch === '\r') { result += '\\r'; continue }
    if (inString && ch === '\t') { result += '\\t'; continue }
    result += ch
  }
  return result
}

function parsePackage(text: string): string[] {
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '')
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    // Two attempts: raw parse first, then with escaped newlines
    for (const candidate of [jsonMatch[0], fixJsonNewlines(jsonMatch[0])]) {
      try {
        const parsed = JSON.parse(candidate)
        const hook    = stripLabel((parsed.hook    ?? '').trim()).replace(/\\n/g, '\n')
        const caption = stripLabel((parsed.caption ?? '').trim()).replace(/\\n/g, '\n')
        const script  = stripLabel((parsed.script  ?? '').trim()).replace(/\\n/g, '\n')
        const cta     = stripLabel((parsed.cta     ?? '').trim()).replace(/\\n/g, '\n')
        if (hook || caption || script || cta) return [hook, caption, script, cta]
      } catch { /* try next candidate */ }
    }
  }
  return [text.trim()]
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function fmtBenchmarkEngagement(b: CompetitorBenchmark): string {
  const parts: string[] = []
  if (b.views && b.views > 0) parts.push(`${b.views >= 1_000_000 ? `${(b.views / 1_000_000).toFixed(1)}M` : b.views >= 1_000 ? `${Math.round(b.views / 1_000)}K` : b.views} views`)
  if (b.likes && b.likes > 0) parts.push(`${b.likes >= 1_000 ? `${Math.round(b.likes / 1_000)}K` : b.likes} likes`)
  if (b.comments && b.comments > 0) parts.push(`${b.comments >= 1_000 ? `${Math.round(b.comments / 1_000)}K` : b.comments} comments`)
  return parts.join(' · ')
}

function buildPrompt(
  brand: { name: string; niche: string; target_location: string | null },
  theme: string,
  platform: string,
  tone: string,
  source: GenerateSource,
  savedHooks: { text: string }[],
  seoKeywords: { keyword: string; intent: string | null }[],
  competitorBenchmarks: CompetitorBenchmark[],
): string {
  const loc = brand.target_location ? ` based in ${brand.target_location}` : ''
  const plat = platformLabel(platform)
  const themeLbl = themeLabel(theme)
  const themeInstr = themeInstructions(theme)

  const voiceSection = savedHooks.length > 0
    ? `BRAND VOICE — match this style:\n${savedHooks.map((h, i) => `${i + 1}. "${h.text}"`).join('\n')}\n\n`
    : ''

  const kwSection = seoKeywords.length > 0
    ? `TARGET KEYWORDS — weave naturally where relevant:\n${seoKeywords.map((k) => `• ${k.keyword}${k.intent ? ` (${k.intent})` : ''}`).join('\n')}\n\n`
    : ''

  const benchmarkSection = competitorBenchmarks.length > 0
    ? `COMPETITOR BENCHMARKS — top content in your market right now:\n${
        competitorBenchmarks.map((b, i) => {
          const text = (b.hook ?? (b.caption ?? '').slice(0, 120)).slice(0, 120)
          const eng = fmtBenchmarkEngagement(b)
          const plat = b.platform ? ` (${platformLabel(b.platform)})` : ''
          return `${i + 1}. "${text}"${eng ? ` — ${eng}` : ''}${plat}`
        }).join('\n')
      }\nStudy the angles that get traction. Generate something that outperforms these — fresher, more specific, stronger hook.\n\n`
    : ''

  let sourceSection = ''
  if (source.type === 'trending_topic') {
    sourceSection = `TRENDING TOPIC INSPIRATION: "${source.title}"\nContext: ${source.summary}\n\n`
  } else if (source.type === 'competitor_post') {
    const postText = (source.hook ?? (source.caption ?? '').slice(0, 300)).slice(0, 300)
    const engStr = fmtEngagement(source)
    const extraEng = [
      source.comments && source.comments > 0 ? `${source.comments >= 1_000 ? `${Math.round(source.comments / 1_000)}K` : source.comments} comments` : null,
      source.shares && source.shares > 0 ? `${source.shares >= 1_000 ? `${Math.round(source.shares / 1_000)}K` : source.shares} shares` : null,
    ].filter(Boolean).join(', ')
    const platStr = source.platform ? ` on ${platformLabel(source.platform)}` : ''
    sourceSection = `HIGH-PERFORMING COMPETITOR POST (${engStr}${extraEng ? `, ${extraEng}` : ''}${platStr}):\n"${postText}"\n${source.transcript ? `Transcript excerpt: "${source.transcript}"\n` : ''}Reimagine in your brand voice — same core angle, completely different words and structure.\n\n`
  } else {
    sourceSection = `BRIEF: ${source.brief}\n\n`
  }

  return `You are writing social media content for ${brand.name}, a ${brand.niche} brand${loc}.

Write like a real person talking to another person — not like a brand, not like a marketing deck, not like ChatGPT. Use plain everyday language. Short sentences. Contractions. First person where natural. No buzzwords, no motivational-poster phrases, no corporate speak. Banned words: thriving, unlock, leverage, dynamic, synergy, game-changer, journey, empower, curated, seamless, cutting-edge, innovative, robust. Be specific and concrete — say exactly what you mean, never dress it up.

IMPORTANT — content boundaries:
- Never write about wars, conflicts, geopolitical instability, terrorism, or political tensions. These topics damage brand trust.
- If the inspiration source involves conflict or instability, completely ignore that angle. Reframe it as market confidence content instead — e.g. why Dubai real estate stays strong, historical resilience, factual data.
- Never use fear-based messaging. Always stay positive, grounded, and solution-focused.
- Do not invent news, events, or situations that are unverified.

CONTENT THEME: ${themeLbl}
${themeInstr}

PLATFORM: ${plat}
TONE: ${tone}

${sourceSection}${benchmarkSection}${voiceSection}${kwSection}FACTUAL GROUNDING — use real Dubai real estate data where relevant:
- Dubai avg rental yields: 6–9% (vs global avg 2–4%)
- No income tax, no capital gains tax on property
- Off-plan projects: 1% monthly payment plans common; post-handover plans available
- RERA regulated; title deeds issued by Dubai Land Department
- Top investment areas: Dubai Marina, Downtown, JVC, Business Bay, Palm Jumeirah, Dubai Hills
- 2024 transaction volume exceeded AED 411 billion (record high)
- Expats can own freehold in 65+ designated areas
Only include data points that are genuinely relevant to the theme. Do not invent statistics.

Generate a complete social media content package. Return ONLY valid JSON — no markdown fences, no extra text. Do NOT prefix values with field names (e.g. never start the hook value with "Hook:"):
{
  "hook": "1-2 lines. Speak DIRECTLY to your target audience in the first word or two — if this is agent recruitment, open with something only an agent would feel (e.g. 'Tired of splitting commission?'). If it's for buyers, open with something only a buyer would feel. If it's for investors, speak to their money. No generic openers. Make the right person feel instantly seen — and the wrong person can keep scrolling.",
  "caption": "The first sentence must confirm who this is for — your reader should immediately know 'this is about me'. Then write like a real person, not a brochure. Short paragraphs (2-3 sentences each). Blank line between paragraphs. Simple everyday words — no buzzwords, no corporate speak. End with one clear action (DM, comment, link in bio). Then add 5-8 hashtags on a new line. Max 2 emojis total.",
  "script": "Write exactly how a real person talks — not how a brand sounds. Use short sentences. Use 'I', 'we', 'you'. Contractions are good (don't, you're, it's). Start with something that would actually make someone stop scrolling — a surprising fact, a blunt opinion, a relatable moment. No motivational-poster language. No 'Are you looking for...?' openers. No buzzwords like 'journey', 'leverage', 'game-changer', 'unlock'. Just say the thing directly. The whole script should feel like you're talking to a friend, not presenting to a boardroom. 30–60 seconds when spoken out loud. End with one clear, natural call to action. No labels, no section headers — pure spoken words.",
  "cta": "Short and direct. Tell them exactly what to do next. Max 2 sentences."
}`
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GROQ_API_KEY secret is not set. Go to Supabase Dashboard → Edge Functions → Manage secrets.' }),
        { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const { brand_id, theme, platform, tone, source } = await req.json() as {
      brand_id: string
      theme: string
      platform: string
      tone: string
      source: GenerateSource
    }

    if (!brand_id || !theme || !platform || !tone || !source) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: brand_id, theme, platform, tone, source' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const authResult = await requireUser(req, supabase, CORS_HEADERS)
    if (authResult.error) return authResult.error
    const accessResult = await requireBrandAccess(supabase, brand_id, authResult.user.id, authResult.user.email, CORS_HEADERS)
    if (accessResult.error) return accessResult.error

    const [brandRes, hooksRes, kwRes, compRes] = await Promise.all([
      supabase.from('brand_profiles').select('name, niche, target_location').eq('id', brand_id).single(),
      supabase.from('saved_hooks').select('text').eq('brand_id', brand_id)
        .order('created_at', { ascending: false }).limit(5),
      supabase.from('seo_keywords').select('keyword, intent')
        .eq('brand_id', brand_id)
        .neq('status', 'targeting')
        .limit(8),
      supabase.from('competitor_posts')
        .select('platform, hook, caption, views, likes, comments, shares')
        .eq('brand_id', brand_id)
        .or('views.gt.0,likes.gt.0')
        .order('views', { ascending: false, nullsFirst: false })
        .limit(5),
    ])

    if (brandRes.error || !brandRes.data) {
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const benchmarks = (compRes.data ?? []) as CompetitorBenchmark[]
    const prompt = buildPrompt(brandRes.data, theme, platform, tone, source, hooksRes.data ?? [], kwRes.data ?? [], benchmarks)
    const rawText = await groq(prompt)
    if (!rawText) throw new Error('Groq returned an empty response')

    const output = parsePackage(rawText)

    const brief =
      source.type === 'trending_topic'
        ? source.title
        : source.type === 'competitor_post'
        ? `Remix: ${(source.caption ?? source.hook ?? '').slice(0, 100)}`
        : source.brief

    const storedPlatform = platform === 'meta' ? 'instagram' : platform

    const { data: record, error: insertError } = await supabase
      .from('generated_content')
      .insert({ brand_id, type: theme, platform: storedPlatform, brief, output, tone })
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
