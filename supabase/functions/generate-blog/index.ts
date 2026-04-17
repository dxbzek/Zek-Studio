// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY')
const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function gemini(prompt: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${GOOGLE_AI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })
  if (!res.ok) throw new Error(`Gemini error (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const { mode, brandName, niche, title } = await req.json()

    if (mode === 'ideas') {
      const prompt = `Generate 5 blog post title ideas for a ${niche} brand called "${brandName}".
Focus on topics that rank well in traditional SEO, appear in AI-generated answers (AEO), and get cited in generative engine results (GEO).
Return ONLY a JSON array of 5 strings, nothing else. Example: ["Title 1", "Title 2"]`

      const raw = await gemini(prompt)
      const match = raw.match(/\[[\s\S]*\]/)
      const titles: string[] = match ? JSON.parse(match[0]) : []
      return new Response(JSON.stringify({ titles }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }

    if (mode === 'draft') {
      const prompt = `Write a comprehensive, well-structured blog post for "${brandName}" (a ${niche} brand) with the title: "${title}".

Optimize for:
- **SEO**: Use H1 title, H2 subheadings, keyword-rich intro, mark internal linking opportunities as [INTERNAL LINK: topic]
- **AEO**: Include a "Frequently Asked Questions" section at the end with 3-5 questions and concise direct answers
- **GEO**: Cite statistics and authoritative sources, include expertise-driven insights, add a brief author perspective section

Format in Markdown. Write at least 800 words.`

      const content = await gemini(prompt)
      return new Response(JSON.stringify({ content }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Invalid mode' }), { status: 400, headers: CORS_HEADERS })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS })
  }
})
