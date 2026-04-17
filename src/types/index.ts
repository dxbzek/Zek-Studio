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

export type ContentType = 'hook' | 'caption' | 'idea'
export type ContentTone = 'professional' | 'casual' | 'humorous' | 'inspirational' | 'educational'

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

// ─── Brand KPIs ───────────────────────────────────────────────────────────────

export type KPIMetric = 'avg_views' | 'avg_engagement_rate' | 'avg_reach' | 'posts_per_month'

export interface BrandKPI {
  id: string
  brand_id: string
  platform: string
  metric: KPIMetric
  target_value: number
  created_at: string
  updated_at: string
}

export type BrandKPIInsert = Omit<BrandKPI, 'id' | 'created_at' | 'updated_at'>
