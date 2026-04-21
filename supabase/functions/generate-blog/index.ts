// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireUser } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'


async function groq(prompt: string, maxTokens = 2048): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: maxTokens,
    }),
  })
  if (!res.ok) throw new Error(`Groq error (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

Deno.serve(async (req) => {
  const CORS_HEADERS = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY)
    const authResult = await requireUser(req, sb, CORS_HEADERS)
    if (authResult.error) return authResult.error

    const { mode, brandName, niche, title, targetKeyword } = await req.json()

    if (mode === 'ideas') {
      const prompt = `Generate 5 blog post title ideas for a ${niche} brand called "${brandName}".
Focus on topics that rank well in traditional SEO, appear in AI-generated answers (AEO), and get cited in generative engine results (GEO).
Return ONLY a JSON array of 5 strings, nothing else. Example: ["Title 1", "Title 2"]`

      const raw = await groq(prompt, 512)
      const match = raw.match(/\[[\s\S]*\]/)
      const titles: string[] = match ? JSON.parse(match[0]) : []
      return new Response(JSON.stringify({ titles }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (mode === 'draft') {
      const kwHint = targetKeyword ? ` Target keyword: "${targetKeyword}".` : ''
      const prompt = `Write a comprehensive, publish-ready blog post for "${brandName}" (a ${niche} brand) with the title: "${title}".${kwHint}

Requirements:
- Output ONLY clean HTML using these tags: <h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>. No other tags.
- DO NOT use Markdown. No # hashtags, no **, no backticks, no dashes as bullets, no code blocks.
- DO NOT include any placeholder text like [INTERNAL LINK: ...] or [INSERT LINK HERE].
- The content must be ready to paste directly into a blog CMS with no editing needed.
- Write at least 800 words.
- SEO: keyword-rich intro paragraph, descriptive subheadings, naturally referenced related topics
- AEO: include a "Frequently Asked Questions" section near the end with 3-5 questions as <h3> and answers as <p>
- GEO: cite real statistics and authoritative sources inline, include a brief author expertise/perspective paragraph

After the article HTML, on a new line, output exactly this JSON block (no markdown, no fences):
METADATA:{"slug":"url-friendly-slug-here","meta_title":"SEO meta title under 60 chars","meta_description":"Compelling meta description 140-160 chars"}`

      const raw = await groq(prompt, 3000)

      // Convert any markdown the LLM output despite instructions
      function sanitizeToHtml(text: string): string {
        return text
          .replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/^## (.+)$/gm, '<h2>$1</h2>')
          .replace(/^# (.+)$/gm, '<h1>$1</h1>')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/^- (.+)$/gm, '<li>$1</li>')
          .replace(/```[\s\S]*?```/g, '')
      }

      // Split content from metadata. Cap the JSON block at 8KB so a runaway
      // model response can't blow up the parse or the insert downstream.
      const META_MAX_BYTES = 8 * 1024
      const metaMatch = raw.match(/METADATA:(\{[\s\S]*?\})\s*$/)
      let content = sanitizeToHtml(raw)
      let slug: string | null = null
      let meta_title: string | null = null
      let meta_description: string | null = null

      if (metaMatch && metaMatch[1].length <= META_MAX_BYTES) {
        content = sanitizeToHtml(raw.slice(0, metaMatch.index).trim())
        try {
          const meta = JSON.parse(metaMatch[1])
          if (meta && typeof meta === 'object') {
            slug = typeof meta.slug === 'string' ? meta.slug.slice(0, 200) : null
            meta_title = typeof meta.meta_title === 'string' ? meta.meta_title.slice(0, 200) : null
            meta_description = typeof meta.meta_description === 'string'
              ? meta.meta_description.slice(0, 400)
              : null
          }
        } catch { /* ignore parse errors */ }
      }

      return new Response(JSON.stringify({ content, slug, meta_title, meta_description }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid mode' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
