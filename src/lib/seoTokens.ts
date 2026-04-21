import type {
  BlogPostStatus,
  SeoAuditCategory,
  SeoAuditPriority,
  SeoKeywordDifficulty,
  SeoKeywordIntent,
  SeoKeywordStatus,
} from '@/types'

// SEO page palettes. Kept in a dedicated module because the SEO surface has
// several orthogonal state axes (keyword difficulty, intent, ranking status,
// blog publish state, audit priority) that don't belong in the shared
// calendar/task statusTokens file.

export const SEO_DIFFICULTY_CHIP: Record<SeoKeywordDifficulty, string> = {
  easy:   'bg-green-500/10 text-green-600 dark:text-green-400',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  hard:   'bg-red-500/10 text-red-600 dark:text-red-400',
}

export const SEO_INTENT_CHIP: Record<SeoKeywordIntent, string> = {
  buy:    'bg-green-500/10 text-green-600 dark:text-green-400',
  info:   'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  invest: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  local:  'bg-purple-500/10 text-purple-600 dark:text-purple-400',
}

export const SEO_KW_STATUS_CHIP: Record<SeoKeywordStatus, string> = {
  targeting:   'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  page_1_2:    'bg-green-500/10 text-green-600 dark:text-green-400',
  page_3_plus: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

export const SEO_KW_STATUS_LABEL: Record<SeoKeywordStatus, string> = {
  targeting:   'Targeting',
  in_progress: 'In Progress',
  page_1_2:    'Page 1–2',
  page_3_plus: 'Page 3+',
}

export const BLOG_STATUS_CHIP: Record<BlogPostStatus, string> = {
  idea:      'bg-muted text-muted-foreground',
  draft:     'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  published: 'bg-green-500/10 text-green-600 dark:text-green-400',
}

export const SEO_AUDIT_PRIORITY_CHIP: Record<SeoAuditPriority, string> = {
  p0: 'bg-red-500/10 text-red-600 dark:text-red-400',
  p1: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  ok: 'bg-green-500/10 text-green-600 dark:text-green-400',
}

export const SEO_AUDIT_PRIORITY_LABEL: Record<SeoAuditPriority, string> = {
  p0: 'P0 Critical',
  p1: 'P1 Important',
  ok: 'OK',
}

export const SEO_AUDIT_CATEGORY_LABEL: Record<SeoAuditCategory, string> = {
  technical: 'Technical',
  on_page:   'On-Page',
  off_page:  'Off-Page',
  local:     'Local',
}
