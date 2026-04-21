// deno-lint-ignore-file no-explicit-any
// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireUser, requireBrandAccess } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function getVideoHeaders(url: string): HeadersInit {
  const headers: HeadersInit = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  }
  if (url.includes('instagram.com') || url.includes('cdninstagram.com')) {
    headers['Referer'] = 'https://www.instagram.com/'
  } else if (url.includes('tiktok.com') || url.includes('tiktokcdn.com')) {
    headers['Referer'] = 'https://www.tiktok.com/'
  } else if (url.includes('youtube.com') || url.includes('googlevideo.com')) {
    headers['Referer'] = 'https://www.youtube.com/'
  }
  return headers
}

serve(async (req) => {
  const CORS_HEADERS = corsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({
          error: 'GROQ_API_KEY secret is not set. Go to Supabase Dashboard → Edge Functions → Manage secrets and add it.',
        }),
        { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const { post_id, video_url } = await req.json()

    if (!post_id || !video_url) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: post_id, video_url' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const sbAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const authResult = await requireUser(req, sbAuth, CORS_HEADERS)
    if (authResult.error) return authResult.error

    const { data: post } = await sbAuth
      .from('competitor_posts')
      .select('brand_id')
      .eq('id', post_id)
      .maybeSingle()
    if (!post) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
    const accessResult = await requireBrandAccess(sbAuth, post.brand_id, authResult.user.id, authResult.user.email, CORS_HEADERS)
    if (accessResult.error) return accessResult.error

    // Download the video
    const videoRes = await fetch(video_url, {
      headers: getVideoHeaders(video_url),
    })

    if (!videoRes.ok) {
      throw new Error(
        `Failed to download video (${videoRes.status}). The URL may have expired — try re-scraping this competitor.`,
      )
    }

    const videoBuffer = await videoRes.arrayBuffer()
    const MB = 1024 * 1024

    if (videoBuffer.byteLength > 25 * MB) {
      throw new Error('Video is larger than 25 MB — too large for transcription.')
    }

    // Send to Groq Whisper as multipart form
    const blob = new Blob([videoBuffer], { type: 'video/mp4' })
    const formData = new FormData()
    formData.append('file', blob, 'video.mp4')
    formData.append('model', 'whisper-large-v3-turbo')
    formData.append('response_format', 'text')

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: formData,
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text()
      throw new Error(`Groq error (${groqRes.status}): ${errText}`)
    }

    const transcript = (await groqRes.text()).trim()

    if (!transcript) throw new Error('Groq returned an empty transcript.')

    // Save to DB
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { error: dbError } = await supabase
      .from('competitor_posts')
      .update({ transcript })
      .eq('id', post_id)

    if (dbError) throw new Error(dbError.message)

    return new Response(
      JSON.stringify({ transcript }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
