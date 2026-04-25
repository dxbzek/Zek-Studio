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
const REPURPOSE_PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'LinkedIn']

async function groq(prompt: string): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 1500,
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

    const { brand_id, original_content, original_platform, content_type } = await req.json()
    if (!brand_id) {
      return new Response(JSON.stringify({ error: 'Missing required field: brand_id' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const accessResult = await requireBrandAccess(sb, brand_id, authResult.user.id, authResult.user.email, CORS)
    if (accessResult.error) return accessResult.error

    const { data: brand } = await sb
      .from('brand_profiles')
      .select('name, niche')
      .eq('id', brand_id)
      .single()

    const prompt = `You are repurposing social media content for ${brand.name}, a ${brand.niche} brand.

ORIGINAL ${(content_type as string).toUpperCase()} (written for ${original_platform}):
"${original_content}"

Rewrite this ${content_type} for each platform below, adapting length, hashtags, and format to fit platform norms. Keep the core message — make it native to each platform.

VOICE — match the original's voice; do not "improve" it:
- If the original is plain and direct, do not add hype, filler emojis, or "🔥 Big news!" intros.
- Real person tone. Short sentences. Contractions. No corporate or motivational framing.
- No buzzwords: thriving, unlock, leverage, dynamic, synergy, game-changer, journey, empower, curated, seamless, cutting-edge, innovative, robust.
- No filler closers like "What are your thoughts?" / "Let me know in the comments!" unless the original ends that way.
- LinkedIn does NOT need to start with "🚀" or "Excited to share" — write it like a competent person, not a LinkedIn parody.
- Max 1-2 emojis per variant, only if the platform truly expects them.

${REPURPOSE_PLATFORMS.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Format:
1. Instagram: [content]
2. TikTok: [content]
3. Facebook: [content]
4. YouTube: [content]
5. LinkedIn: [content]

Only output the numbered list. Nothing else.`

    const text = await groq(prompt)

    // Parse numbered platform list
    const variants: { platform: string; output: string }[] = []
    for (const line of text.split('\n')) {
      const match = line.match(/^\d+\.\s+(\w+):\s+(.+)/)
      if (match) variants.push({ platform: match[1].toLowerCase(), output: match[2].trim() })
    }

    return new Response(JSON.stringify({ variants }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
