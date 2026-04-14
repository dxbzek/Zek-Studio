// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  created_at: string
}

// ─── Platforms ───────────────────────────────────────────────────────────────

export type Platform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'linkedin'
  | 'youtube'

export const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
]

// ─── Brand Profiles ──────────────────────────────────────────────────────────

export interface BrandProfile {
  id: string
  user_id: string
  name: string
  niche: string
  website_url: string | null
  platforms: Platform[]
  avatar_url: string | null
  color: string | null
  created_at: string
  updated_at: string
}

export type BrandProfileInsert = Omit<BrandProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type BrandProfileUpdate = Partial<BrandProfileInsert>

// ─── Competitors ─────────────────────────────────────────────────────────────

export interface Competitor {
  id: string
  brand_id: string
  handle: string
  platform: Platform
  last_scraped_at: string | null
  created_at: string
}

// ─── Competitor Posts ─────────────────────────────────────────────────────────

export interface CompetitorPost {
  id: string
  competitor_id: string
  brand_id: string
  platform: Platform
  url: string | null
  caption: string | null
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  hook: string | null
  thumbnail_url: string | null
  posted_at: string | null
  created_at: string
}

// ─── Saved Hooks ─────────────────────────────────────────────────────────────

export interface SavedHook {
  id: string
  brand_id: string
  text: string
  source_post_id: string | null
  platform: Platform | null
  tags: string[]
  created_at: string
}

// ─── Niche Research ──────────────────────────────────────────────────────────

export interface NicheResearchCache {
  id: string
  brand_id: string
  query: string
  results: NicheResearchResults
  fetched_at: string
}

export interface NicheResearchResults {
  trending_topics: TrendingTopic[]
  top_creators: TopCreator[]
}

export interface TrendingTopic {
  title: string
  summary: string
  url: string
  source: string
  published_at: string | null
}

export interface TopCreator {
  name: string
  handle: string
  platform: Platform
  bio: string | null
  estimated_followers: string | null
  url: string | null
}

// ─── Generated Content ───────────────────────────────────────────────────────

export type ContentType = 'hook' | 'caption' | 'idea'
export type ContentTone = 'professional' | 'casual' | 'humorous' | 'inspirational' | 'educational'

export interface GeneratedContent {
  id: string
  brand_id: string
  type: ContentType
  platform: Platform
  brief: string
  output: string[]
  tone: ContentTone
  created_at: string
}

// ─── Calendar ────────────────────────────────────────────────────────────────

export type CalendarStatus = 'draft' | 'scheduled' | 'published'

export interface CalendarEntry {
  id: string
  brand_id: string
  platform: Platform
  content_type: ContentType
  title: string
  body: string | null
  scheduled_date: string
  status: CalendarStatus
  generated_content_id: string | null
  created_at: string
  updated_at: string
}

export type CalendarEntryInsert = Omit<CalendarEntry, 'id' | 'created_at' | 'updated_at'>
export type CalendarEntryUpdate = Partial<CalendarEntryInsert>
