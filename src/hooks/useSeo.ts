import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  SeoKeyword, SeoKeywordInsert, SeoKeywordUpdate,
  BlogPost, BlogPostInsert, BlogPostUpdate,
  SeoAuditItem, SeoAuditItemInsert, SeoAuditItemUpdate,
  ReviewSnapshot, ReviewSnapshotInsert,
} from '@/types'

const db = supabase as any

// ─── Keywords ────────────────────────────────────────────────────────────────

export function useSeoKeywords(brandId: string | null) {
  const qc = useQueryClient()

  const { data: keywords = [], isLoading } = useQuery({
    queryKey: ['seo-keywords', brandId],
    queryFn: async () => {
      if (!brandId) return []
      const { data, error } = await db
        .from('seo_keywords')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as SeoKeyword[]
    },
    enabled: !!brandId,
  })

  const addKeyword = useMutation({
    mutationFn: async (insert: SeoKeywordInsert) => {
      const { data, error } = await db.from('seo_keywords').insert(insert).select().single()
      if (error) throw error
      return data as SeoKeyword
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seo-keywords', brandId] }),
  })

  const updateKeyword = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: SeoKeywordUpdate }) => {
      const { data, error } = await db.from('seo_keywords').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data as SeoKeyword
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seo-keywords', brandId] }),
  })

  const deleteKeyword = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('seo_keywords').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seo-keywords', brandId] }),
  })

  return { keywords, isLoading, addKeyword, updateKeyword, deleteKeyword }
}

// ─── Blog Posts ───────────────────────────────────────────────────────────────

export function useBlogPosts(brandId: string | null) {
  const qc = useQueryClient()

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blog-posts', brandId],
    queryFn: async () => {
      if (!brandId) return []
      const { data, error } = await db
        .from('blog_posts')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as BlogPost[]
    },
    enabled: !!brandId,
  })

  const addPost = useMutation({
    mutationFn: async (insert: BlogPostInsert) => {
      const { data, error } = await db.from('blog_posts').insert(insert).select().single()
      if (error) throw error
      return data as BlogPost
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blog-posts', brandId] }),
  })

  const updatePost = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: BlogPostUpdate }) => {
      const { data, error } = await db
        .from('blog_posts')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as BlogPost
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blog-posts', brandId] }),
  })

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('blog_posts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blog-posts', brandId] }),
  })

  return { posts, isLoading, addPost, updatePost, deletePost }
}

// ─── Audit ────────────────────────────────────────────────────────────────────

const DEFAULT_AUDIT_ITEMS: Omit<SeoAuditItemInsert, 'brand_id'>[] = [
  { category: 'technical', issue: 'Set up and verify Google Search Console', status: 'not_done', priority: 'p0', sort_order: 0 },
  { category: 'technical', issue: 'Submit XML sitemap to GSC', status: 'not_done', priority: 'p0', sort_order: 1 },
  { category: 'technical', issue: 'Run PageSpeed Insights — fix mobile issues', status: 'not_done', priority: 'p1', sort_order: 2 },
  { category: 'technical', issue: 'Confirm HTTPS / SSL is active', status: 'not_done', priority: 'ok', sort_order: 3 },
  { category: 'on_page', issue: 'Write unique meta descriptions for all key pages', status: 'not_done', priority: 'p1', sort_order: 0 },
  { category: 'on_page', issue: 'Add H1 / H2 structure to all blog posts', status: 'not_done', priority: 'p0', sort_order: 1 },
  { category: 'on_page', issue: 'Add schema markup (LocalBusiness + content type)', status: 'not_done', priority: 'p1', sort_order: 2 },
  { category: 'on_page', issue: 'Internal links: every blog post links to relevant pages', status: 'not_done', priority: 'p1', sort_order: 3 },
  { category: 'on_page', issue: 'Target keyword in title, URL, and first paragraph', status: 'not_done', priority: 'p1', sort_order: 4 },
  { category: 'off_page', issue: 'Submit to 5 relevant industry directories', status: 'not_done', priority: 'p1', sort_order: 0 },
  { category: 'off_page', issue: 'Identify and reach out for 3 quality backlinks', status: 'not_done', priority: 'p1', sort_order: 1 },
  { category: 'local', issue: 'Fully set up Google My Business (photos, hours, categories)', status: 'not_done', priority: 'p0', sort_order: 0 },
  { category: 'local', issue: 'Launch review request campaign', status: 'not_done', priority: 'p0', sort_order: 1 },
  { category: 'local', issue: 'Respond to all existing Google reviews', status: 'not_done', priority: 'p1', sort_order: 2 },
]

export function useSeoAudit(brandId: string | null) {
  const qc = useQueryClient()

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['seo-audit', brandId],
    queryFn: async () => {
      if (!brandId) return []
      const { data, error } = await db
        .from('seo_audit_items')
        .select('*')
        .eq('brand_id', brandId)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as SeoAuditItem[]
    },
    enabled: !!brandId,
  })

  const seedDefaults = useMutation({
    mutationFn: async () => {
      if (!brandId) throw new Error('No brand selected')
      const rows = DEFAULT_AUDIT_ITEMS.map((item) => ({ ...item, brand_id: brandId }))
      const { error } = await db.from('seo_audit_items').insert(rows)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seo-audit', brandId] }),
  })

  const updateItem = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: SeoAuditItemUpdate }) => {
      const { data, error } = await db.from('seo_audit_items').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data as SeoAuditItem
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seo-audit', brandId] }),
  })

  const addItem = useMutation({
    mutationFn: async (insert: SeoAuditItemInsert) => {
      const { data, error } = await db.from('seo_audit_items').insert(insert).select().single()
      if (error) throw error
      return data as SeoAuditItem
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seo-audit', brandId] }),
  })

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('seo_audit_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seo-audit', brandId] }),
  })

  return { items, isLoading, seedDefaults, updateItem, addItem, deleteItem }
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export function useReviewSnapshots(brandId: string | null) {
  const qc = useQueryClient()

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['review-snapshots', brandId],
    queryFn: async () => {
      if (!brandId) return []
      const { data, error } = await db
        .from('review_snapshots')
        .select('*')
        .eq('brand_id', brandId)
        .order('recorded_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ReviewSnapshot[]
    },
    enabled: !!brandId,
  })

  const logSnapshot = useMutation({
    mutationFn: async (insert: ReviewSnapshotInsert) => {
      const { data, error } = await db.from('review_snapshots').insert(insert).select().single()
      if (error) throw error
      return data as ReviewSnapshot
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review-snapshots', brandId] }),
  })

  const deleteSnapshot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('review_snapshots').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review-snapshots', brandId] }),
  })

  return { snapshots, isLoading, logSnapshot, deleteSnapshot }
}
