// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_AI_API_KEY}`
const REPURPOSE_PLATFORMS = ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'LinkedIn']

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

    const { brand_id, original_content, original_platform, content_type } = await req.json()
    const { data: brand } = await sb
      .from('brand_profiles')
      .select('name, niche')
      .eq('id', brand_id)
      .single()

    const prompt = `You are a social media content expert for ${brand.name}, a ${brand.niche} brand.

ORIGINAL ${(content_type as string).toUpperCase()} (written for ${original_platform}):
"${original_content}"

Rewrite this ${content_type} for each platform below, adapting length, tone, hashtags, and format to fit platform norms. Keep the core message — make it native to each platform.

${REPURPOSE_PLATFORMS.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Format:
1. Instagram: [content]
2. TikTok: [content]
3. Facebook: [content]
4. YouTube: [content]
5. LinkedIn: [content]

Only output the numbered list. Nothing else.`

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 1500 },
      }),
    })

    if (!geminiRes.ok) throw new Error(`Gemini error: ${await geminiRes.text()}`)
    const geminiData = await geminiRes.json()
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

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
