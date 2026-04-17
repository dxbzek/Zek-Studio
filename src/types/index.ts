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

// Generator-specific platform list — merges Instagram + Facebook into Meta
export type GeneratorPlatform = 'meta' | 'tiktok' | 'linkedin' | 'youtube'

export const GENERATOR_PLATFORMS: { value: GeneratorPlatform; label: string }[] = [
  { value: 'meta', label: 'Meta (IG + FB)' },
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
  target_location: string | null
  website_url: string | null
  platforms: Platform[]
  avatar_url: string | null
  color: string | null
  instagram_handle: string | null
  tiktok_handle: string | null
  facebook_handle: string | null
  youtube_handle: string | null
  linkedin_handle: string | null
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
  video_url: string | null
  transcript: string | null
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
  top_post_views: number | null
  top_post_likes: number | null
  top_post_url: string | null
  top_post_date: string | null
}

// ─── Generated Content ───────────────────────────────────────────────────────

export type ContentType = 'hook' | 'caption' | 'idea' | 'script' | 'listing' | 'market' | 'story' | 'cta'
export type ContentTone = 'professional' | 'casual' | 'humorous' | 'inspirational' | 'educational' | 'authoritative' | 'luxurious' | 'urgent'

export type GenerateSource =
  | { type: 'trending_topic'; title: string; summary: string }
  | { type: 'competitor_post'; caption: string | null; hook: string | null; views: number | null; likes: number | null }
  | { type: 'manual'; brief: string }

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
export type ApprovalStatus = 'pending_review' | 'approved' | 'rejected'

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
  campaign_id: string | null
  pillar_id: string | null
  approval_status: ApprovalStatus | null
  approval_note: string | null
  created_at: string
  updated_at: string
}

export type CalendarEntryInsert = Omit<CalendarEntry, 'id' | 'created_at' | 'updated_at'>
export type CalendarEntryUpdate = Partial<CalendarEntryInsert>

// ─── Team Members ─────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string
  brand_id: string
  user_id: string | null
  email: string
  role: 'specialist'
  invited_at: string
  accepted_at: string | null
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type TaskType     = 'content' | 'shoot' | 'approval' | 'backup' | 'other'
export type TaskStatus   = 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  brand_id: string
  title: string
  description: string | null
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  assignee_id: string | null
  assignee_email: string | null
  calendar_entry_id: string | null
  due_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TaskInsert = Omit<Task, 'id' | 'created_at' | 'updated_at'>
export type TaskUpdate = Partial<TaskInsert>

// ─── Post Metrics ─────────────────────────────────────────────────────────────

export interface PostMetric {
  id: string
  brand_id: string
  calendar_entry_id: string | null
  platform: Platform
  post_url: string | null
  posted_at: string | null
  posted_time: string | null
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  reach: number | null
  impressions: number | null
  notes: string | null
  logged_by: string | null
  created_at: string
  updated_at: string
}

export type PostMetricInsert = Omit<PostMetric, 'id' | 'created_at' | 'updated_at'>
export type PostMetricUpdate = Partial<PostMetricInsert>

// ─── Platform Connections ─────────────────────────────────────────────────────

export type ConnectedPlatform = 'instagram' | 'facebook' | 'tiktok' | 'youtube'

export interface PlatformConnection {
  id: string
  brand_id: string
  platform: ConnectedPlatform
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  platform_account_id: string | null
  platform_account_name: string | null
  scopes: string[] | null
  connected_at: string
  last_synced_at: string | null
}

export type PlatformConnectionSummary = Omit<PlatformConnection, 'access_token' | 'refresh_token'>

// ─── Campaigns ────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string
  brand_id: string
  name: string
  description: string | null
  color: string
  start_date: string | null
  end_date: string | null
  goal: string | null
  created_at: string
  updated_at: string
}
export type CampaignInsert = Omit<Campaign, 'id' | 'created_at' | 'updated_at'>
export type CampaignUpdate = Partial<CampaignInsert>

// ─── Content Pillars ──────────────────────────────────────────────────────────

export interface ContentPillar {
  id: string
  brand_id: string
  label: string
  target_pct: number
  color: string
  created_at: string
}
export type ContentPillarInsert = Omit<ContentPillar, 'id' | 'created_at'>

// ─── Reply Templates ──────────────────────────────────────────────────────────

export interface ReplyTemplate {
  id: string
  brand_id: string
  label: string
  text: string
  platform: Platform | null
  tags: string[]
  created_at: string
}
export type ReplyTemplateInsert = Omit<ReplyTemplate, 'id' | 'created_at'>

// ─── SEO Module ───────────────────────────────────────────────────────────────

export type SeoKeywordDifficulty = 'easy' | 'medium' | 'hard'
export type SeoKeywordIntent     = 'buy' | 'info' | 'invest' | 'local'
export type SeoKeywordStatus     = 'targeting' | 'in_progress' | 'page_1_2' | 'page_3_plus'

export interface SeoKeyword {
  id: string
  brand_id: string
  keyword: string
  volume: number | null
  difficulty: SeoKeywordDifficulty | null
  intent: SeoKeywordIntent | null
  target_url: string | null
  status: SeoKeywordStatus
  created_at: string
}
export type SeoKeywordInsert = Omit<SeoKeyword, 'id' | 'created_at'>
export type SeoKeywordUpdate = Partial<SeoKeywordInsert>

export type BlogPostStatus = 'idea' | 'draft' | 'published'

export interface BlogPost {
  id: string
  brand_id: string
  keyword_id: string | null
  title: string
  status: BlogPostStatus
  word_count: number | null
  target_wc: number
  publish_date: string | null
  url: string | null
  content: string | null
  has_h1h2: boolean
  has_internal_links: boolean
  has_meta_description: boolean
  keyword_in_title: boolean
  has_faq: boolean
  has_schema: boolean
  has_citations: boolean
  has_eeat: boolean
  has_author_bio: boolean
  slug: string | null
  meta_title: string | null
  meta_description: string | null
  created_at: string
  updated_at: string
}
export type BlogPostInsert = Omit<BlogPost, 'id' | 'created_at' | 'updated_at'>
export type BlogPostUpdate = Partial<BlogPostInsert>

export type SeoAuditCategory = 'technical' | 'on_page' | 'off_page' | 'local'
export type SeoAuditStatus   = 'not_done' | 'in_progress' | 'done'
export type SeoAuditPriority = 'p0' | 'p1' | 'ok'

export interface SeoAuditItem {
  id: string
  brand_id: string
  category: SeoAuditCategory
  issue: string
  status: SeoAuditStatus
  priority: SeoAuditPriority
  sort_order: number
  created_at: string
}
export type SeoAuditItemInsert = Omit<SeoAuditItem, 'id' | 'created_at'>
export type SeoAuditItemUpdate = Partial<SeoAuditItemInsert>

export interface ReviewSnapshot {
  id: string
  brand_id: string
  platform: string
  count: number
  target: number | null
  recorded_at: string
  created_at: string
}
export type ReviewSnapshotInsert = Omit<ReviewSnapshot, 'id' | 'created_at'>

// ─── Share Tokens ─────────────────────────────────────────────────────────────

export type ShareTokenType = 'report' | 'approval'

export interface ShareToken {
  id: string
  brand_id: string
  type: ShareTokenType
  token: string
  settings: Record<string, unknown>
  expires_at: string | null
  created_at: string
}
