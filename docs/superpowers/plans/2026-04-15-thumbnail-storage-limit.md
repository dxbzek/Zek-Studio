# Thumbnail Storage + Result Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store competitor post thumbnails in Supabase Storage (fixing CORS/expiry issues) and limit scraped posts to 10 per competitor.

**Architecture:** The `competitor-research` edge function downloads each thumbnail server-side and uploads it to a public Supabase Storage bucket, replacing the ephemeral CDN URL with a permanent storage URL. Result limits are reduced from 30 to 10 across all platforms.

**Tech Stack:** Deno edge function, Supabase Storage (service role client), Supabase SQL migration

---

### Task 1: Limit results to 10

**Files:**
- Modify: `supabase/functions/competitor-research/index.ts`

- [ ] **Step 1: Change all result limits from 30 → 10**

In `buildApifyInput`, update each platform:
```ts
case 'instagram':
  return {
    directUrls: [`https://www.instagram.com/${clean}/`],
    resultsType: 'posts',
    resultsLimit: 10,   // was 30
  }
case 'tiktok':
  return { profiles: [`@${clean}`], resultsPerPage: 10 }  // was 30
case 'youtube':
  return { startUrls: [{ url: `https://www.youtube.com/@${clean}` }], maxResults: 10 }  // was 30
```

In the dataset fetch URL, change `limit=30` → `limit=10`:
```ts
`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=10&clean=true`
```

In the normalize slice, change `.slice(0, 30)` → `.slice(0, 10)`:
```ts
const posts = rawPosts.slice(0, 10).map((raw) => ({
```

- [ ] **Step 2: Deploy**
```bash
npx supabase functions deploy competitor-research --project-ref otyksdmlepmhqwsyxvsn --no-verify-jwt
```

---

### Task 2: Create Supabase Storage bucket

**Files:**
- Create: `supabase/migrations/003_thumbnail_storage.sql`

- [ ] **Step 1: Create migration file and run it in Supabase Dashboard SQL Editor**

```sql
-- Create public bucket for competitor thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('competitor-thumbnails', 'competitor-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read
CREATE POLICY "Public read competitor thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'competitor-thumbnails');

-- Allow service role to insert/update/delete
CREATE POLICY "Service role manages competitor thumbnails"
ON storage.objects FOR ALL
USING (bucket_id = 'competitor-thumbnails');
```

---

### Task 3: Store thumbnails in edge function

**Files:**
- Modify: `supabase/functions/competitor-research/index.ts`

- [ ] **Step 1: Add `storeThumbnail` helper function** after the `normalizePost` function:

```ts
async function storeThumbnail(
  supabase: any,
  thumbnailUrl: string,
  competitorId: string,
  index: number,
): Promise<string | null> {
  try {
    const res = await fetch(thumbnailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.instagram.com/',
      },
    })
    if (!res.ok) return null

    const buffer = await res.arrayBuffer()
    const path = `${competitorId}/${index}.jpg`

    const { error } = await supabase.storage
      .from('competitor-thumbnails')
      .upload(path, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (error) return null

    const { data } = supabase.storage
      .from('competitor-thumbnails')
      .getPublicUrl(path)

    return data.publicUrl
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Call `storeThumbnail` when building posts**

Replace the posts normalization block:
```ts
// Normalize posts and store thumbnails
const posts = await Promise.all(
  rawPosts.slice(0, 10).map(async (raw, index) => {
    const normalized = normalizePost(platform, raw)
    if (normalized.thumbnail_url) {
      const stored = await storeThumbnail(supabase, normalized.thumbnail_url, competitor.id, index)
      if (stored) normalized.thumbnail_url = stored
    }
    return {
      ...normalized,
      competitor_id: competitor.id,
      brand_id,
      platform,
    }
  })
)
```

- [ ] **Step 3: Deploy**
```bash
npx supabase functions deploy competitor-research --project-ref otyksdmlepmhqwsyxvsn --no-verify-jwt
```

- [ ] **Step 4: Re-scrape a competitor to test**
In the app, delete an existing competitor and re-add them. Thumbnails should now load on the cards.
