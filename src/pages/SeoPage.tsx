import { useState } from 'react'
import { Plus, Trash2, ExternalLink, CheckSquare, Square, Loader2, Sparkles, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveBrand } from '@/stores/activeBrand'
import { NoBrandSelected } from '@/components/layout/NoBrandSelected'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useSeoKeywords, useBlogPosts, useSeoAudit, useReviewSnapshots } from '@/hooks/useSeo'
import type {
  BrandProfile,
  SeoKeyword, SeoKeywordDifficulty, SeoKeywordIntent, SeoKeywordStatus,
  BlogPost, BlogPostStatus,
  SeoAuditItem, SeoAuditCategory, SeoAuditStatus, SeoAuditPriority,
} from '@/types'

type Tab = 'keywords' | 'blog' | 'audit' | 'reviews'

// ─── Badge helpers ────────────────────────────────────────────────────────────

const DIFF_STYLES: Record<SeoKeywordDifficulty, string> = {
  easy:   'bg-green-500/10 text-green-600 dark:text-green-400',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  hard:   'bg-red-500/10 text-red-600 dark:text-red-400',
}

const INTENT_STYLES: Record<SeoKeywordIntent, string> = {
  buy:    'bg-green-500/10 text-green-600 dark:text-green-400',
  info:   'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  invest: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  local:  'bg-purple-500/10 text-purple-600 dark:text-purple-400',
}

const KW_STATUS_STYLES: Record<SeoKeywordStatus, string> = {
  targeting:   'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  page_1_2:    'bg-green-500/10 text-green-600 dark:text-green-400',
  page_3_plus: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
}

const KW_STATUS_LABELS: Record<SeoKeywordStatus, string> = {
  targeting:   'Targeting',
  in_progress: 'In Progress',
  page_1_2:    'Page 1–2',
  page_3_plus: 'Page 3+',
}

const BLOG_STATUS_STYLES: Record<BlogPostStatus, string> = {
  idea:      'bg-muted text-muted-foreground',
  draft:     'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  published: 'bg-green-500/10 text-green-600 dark:text-green-400',
}

const PRIORITY_STYLES: Record<SeoAuditPriority, string> = {
  p0: 'bg-red-500/10 text-red-600 dark:text-red-400',
  p1: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  ok: 'bg-green-500/10 text-green-600 dark:text-green-400',
}

const PRIORITY_LABELS: Record<SeoAuditPriority, string> = {
  p0: 'P0 Critical',
  p1: 'P1 Important',
  ok: 'OK',
}

const AUDIT_CATEGORY_LABELS: Record<SeoAuditCategory, string> = {
  technical: 'Technical',
  on_page:   'On-Page',
  off_page:  'Off-Page',
  local:     'Local',
}

const AUDIT_CATEGORIES: SeoAuditCategory[] = ['technical', 'on_page', 'off_page', 'local']

// ─── Blog checklist sections ──────────────────────────────────────────────────

const BLOG_CHECKS = {
  seo: [
    { key: 'has_h1h2' as const,           label: 'H1/H2 structure' },
    { key: 'has_meta_description' as const, label: 'Meta description' },
    { key: 'has_internal_links' as const,   label: 'Internal links' },
    { key: 'keyword_in_title' as const,     label: 'Keyword in title' },
  ],
  aeo: [
    { key: 'has_faq' as const,    label: 'FAQ section' },
    { key: 'has_schema' as const, label: 'Schema markup' },
  ],
  geo: [
    { key: 'has_citations' as const,   label: 'Citations / sources' },
    { key: 'has_eeat' as const,        label: 'E-E-A-T signals' },
    { key: 'has_author_bio' as const,  label: 'Author bio' },
  ],
}
const ALL_CHECKS = [...BLOG_CHECKS.seo, ...BLOG_CHECKS.aeo, ...BLOG_CHECKS.geo]

// ─── Keywords Tab ─────────────────────────────────────────────────────────────

function KeywordsTab({ brandId }: { brandId: string }) {
  const { keywords, isLoading, addKeyword, updateKeyword, deleteKeyword } = useSeoKeywords(brandId)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ keyword: '', volume: '', difficulty: 'easy' as SeoKeywordDifficulty, intent: 'info' as SeoKeywordIntent, target_url: '' })

  async function handleAdd() {
    if (!form.keyword.trim()) return
    try {
      await addKeyword.mutateAsync({
        brand_id: brandId,
        keyword: form.keyword.trim(),
        volume: form.volume ? parseInt(form.volume) : null,
        difficulty: form.difficulty,
        intent: form.intent,
        target_url: form.target_url.trim() || null,
        status: 'targeting',
      })
      setForm({ keyword: '', volume: '', difficulty: 'easy', intent: 'info', target_url: '' })
      setAdding(false)
      toast.success('Keyword added')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{keywords.length} keyword{keywords.length !== 1 ? 's' : ''} tracked</p>
        <Button size="sm" onClick={() => setAdding((v) => !v)} variant={adding ? 'outline' : 'default'} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Keyword
        </Button>
      </div>

      {adding && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Keyword</Label>
              <Input placeholder="e.g. apartments for sale business bay" value={form.keyword} onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Monthly Volume</Label>
              <Input type="number" placeholder="320" value={form.volume} onChange={(e) => setForm((f) => ({ ...f, volume: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Target URL</Label>
              <Input placeholder="https://…" value={form.target_url} onChange={(e) => setForm((f) => ({ ...f, target_url: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Difficulty</Label>
              <Select value={form.difficulty} onValueChange={(v) => setForm((f) => ({ ...f, difficulty: v as SeoKeywordDifficulty }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Intent</Label>
              <Select value={form.intent} onValueChange={(v) => setForm((f) => ({ ...f, intent: v as SeoKeywordIntent }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="invest">Invest</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={addKeyword.isPending}>{addKeyword.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {keywords.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center gap-2">
          <p className="font-medium">No keywords yet</p>
          <p className="text-sm text-muted-foreground">Add your target keywords to start tracking rankings</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Keyword</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs">Volume</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs">Difficulty</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs">Intent</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keywords.map((kw) => (
                <KeywordRow key={kw.id} kw={kw} onUpdate={(patch) => updateKeyword.mutate({ id: kw.id, patch })} onDelete={() => deleteKeyword.mutate(kw.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function KeywordRow({ kw, onUpdate, onDelete }: { kw: SeoKeyword; onUpdate: (p: Partial<SeoKeyword>) => void; onDelete: () => void }) {
  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium">{kw.keyword}</div>
        {kw.target_url && <a href={kw.target_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"><ExternalLink className="h-3 w-3" />{kw.target_url}</a>}
      </td>
      <td className="px-3 py-3 text-center text-muted-foreground font-mono text-xs">{kw.volume?.toLocaleString() ?? '—'}</td>
      <td className="px-3 py-3 text-center">
        {kw.difficulty && <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', DIFF_STYLES[kw.difficulty])}>{kw.difficulty}</span>}
      </td>
      <td className="px-3 py-3 text-center">
        {kw.intent && <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', INTENT_STYLES[kw.intent])}>{kw.intent}</span>}
      </td>
      <td className="px-3 py-3 text-center">
        <Select value={kw.status} onValueChange={(v) => onUpdate({ status: v as SeoKeywordStatus })}>
          <SelectTrigger className="h-7 text-xs w-[120px]">
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', KW_STATUS_STYLES[kw.status])}>{KW_STATUS_LABELS[kw.status]}</span>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(KW_STATUS_LABELS) as SeoKeywordStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{KW_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-3">
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
      </td>
    </tr>
  )
}

// ─── Blog Planner Tab ────────────────────────────────────────────────────────

function BlogTab({ brand }: { brand: BrandProfile }) {
  const { posts, isLoading, addPost, updatePost, deletePost } = useBlogPosts(brand.id)
  const { keywords } = useSeoKeywords(brand.id)
  const [adding, setAdding] = useState(false)
  const [ideas, setIdeas] = useState<string[]>([])
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [form, setForm] = useState({ title: '', keyword_id: '', status: 'idea' as BlogPostStatus, target_wc: '800', publish_date: '', url: '' })

  const published = posts.filter((p) => p.status === 'published').length
  const thisMonth = posts.filter((p) => {
    if (!p.publish_date) return false
    const d = new Date(p.publish_date)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  async function handleGenerateIdeas() {
    setLoadingIdeas(true)
    setIdeas([])
    try {
      const { data, error } = await (supabase as any).functions.invoke('generate-blog', {
        body: { mode: 'ideas', brandName: brand.name, niche: brand.niche },
      })
      if (error) {
        let detail: string = error.message ?? 'Function call failed'
        try {
          const body = await error.context?.json?.()
          if (body?.error) detail = body.error
          else if (body?.message) detail = body.message
        } catch { /* ignore */ }
        throw new Error(detail)
      }
      const titles: string[] = data?.titles ?? []
      if (!titles.length) {
        toast.warning('No ideas returned — make sure the generate-blog function is deployed and GOOGLE_AI_API_KEY is set')
        return
      }
      setIdeas(titles)
    } catch (err) {
      toast.error('Could not generate ideas', { description: (err as Error).message })
    } finally {
      setLoadingIdeas(false)
    }
  }

  async function handleAddIdea(title: string) {
    try {
      await addPost.mutateAsync({
        brand_id: brand.id,
        title,
        keyword_id: null,
        status: 'idea',
        word_count: null,
        target_wc: 800,
        publish_date: null,
        url: null,
        content: null,
        has_h1h2: false, has_internal_links: false, has_meta_description: false, keyword_in_title: false,
        has_faq: false, has_schema: false, has_citations: false, has_eeat: false, has_author_bio: false,
      })
      setIdeas((prev) => prev.filter((t) => t !== title))
      toast.success('Post added to planner')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleAdd() {
    if (!form.title.trim()) return
    try {
      await addPost.mutateAsync({
        brand_id: brand.id,
        title: form.title.trim(),
        keyword_id: form.keyword_id || null,
        status: form.status,
        word_count: null,
        target_wc: parseInt(form.target_wc) || 800,
        publish_date: form.publish_date || null,
        url: form.url.trim() || null,
        content: null,
        has_h1h2: false, has_internal_links: false, has_meta_description: false, keyword_in_title: false,
        has_faq: false, has_schema: false, has_citations: false, has_eeat: false, has_author_bio: false,
      })
      setForm({ title: '', keyword_id: '', status: 'idea', target_wc: '800', publish_date: '', url: '' })
      setAdding(false)
      toast.success('Post added')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-4 flex-1">
          <div className="text-center"><div className="text-2xl font-bold">{posts.length}</div><div className="text-xs text-muted-foreground">Total posts</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-green-600 dark:text-green-400">{published}</div><div className="text-xs text-muted-foreground">Published</div></div>
          <div className="text-center"><div className="text-2xl font-bold text-primary">{thisMonth}</div><div className="text-xs text-muted-foreground">This month</div></div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleGenerateIdeas} disabled={loadingIdeas} className="gap-1.5">
            {loadingIdeas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate Ideas
          </Button>
          <Button size="sm" onClick={() => setAdding((v) => !v)} variant={adding ? 'outline' : 'default'} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Post
          </Button>
        </div>
      </div>

      {ideas.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <p className="text-sm font-medium flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI-suggested blog ideas</p>
          <div className="space-y-2">
            {ideas.map((idea) => (
              <div key={idea} className="flex items-center gap-3">
                <span className="flex-1 text-sm">{idea}</span>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleAddIdea(idea)}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              </div>
            ))}
          </div>
          <button onClick={() => setIdeas([])} className="text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
        </div>
      )}

      {adding && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Title</Label>
              <Input placeholder="e.g. Is It Safe to Buy Resale Property in Dubai?" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Target Keyword</Label>
              <Select value={form.keyword_id} onValueChange={(v) => setForm((f) => ({ ...f, keyword_id: v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {keywords.map((k) => <SelectItem key={k.id} value={k.id}>{k.keyword}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as BlogPostStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">Idea</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Target word count</Label>
              <Input type="number" value={form.target_wc} onChange={(e) => setForm((f) => ({ ...f, target_wc: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Publish date</Label>
              <Input type="date" value={form.publish_date} onChange={(e) => setForm((f) => ({ ...f, publish_date: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={addPost.isPending}>{addPost.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center gap-2">
          <p className="font-medium">No posts planned yet</p>
          <p className="text-sm text-muted-foreground">Use "Generate Ideas" to get AI suggestions, or add posts manually</p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <BlogPostRow key={post.id} post={post} brand={brand} keywords={keywords} onUpdate={(patch) => updatePost.mutate({ id: post.id, patch })} onDelete={() => deletePost.mutate(post.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function BlogPostRow({ post, brand, keywords, onUpdate, onDelete }: { post: BlogPost; brand: BrandProfile; keywords: SeoKeyword[]; onUpdate: (p: Partial<BlogPost>) => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [copied, setCopied] = useState(false)
  const keyword = keywords.find((k) => k.id === post.keyword_id)
  const doneChecks = ALL_CHECKS.filter((c) => post[c.key]).length

  async function handleGenerateDraft() {
    setLoadingDraft(true)
    try {
      const { data, error } = await (supabase as any).functions.invoke('generate-blog', {
        body: { mode: 'draft', brandName: brand.name, niche: brand.niche, title: post.title },
      })
      if (error) {
        let detail: string = error.message ?? 'Function call failed'
        try {
          const body = await error.context?.json?.()
          if (body?.error) detail = body.error
          else if (body?.message) detail = body.message
        } catch { /* ignore */ }
        throw new Error(detail)
      }
      if (!data?.content) throw new Error('No content returned — check that generate-blog is deployed and GOOGLE_AI_API_KEY is set')
      onUpdate({ content: data.content, status: post.status === 'idea' ? 'draft' : post.status })
      setExpanded(true)
      toast.success('Draft generated')
    } catch (err) {
      toast.error('Could not generate draft', { description: (err as Error).message })
    } finally {
      setLoadingDraft(false)
    }
  }

  async function handleCopy() {
    if (!post.content) return
    await navigator.clipboard.writeText(post.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpanded((v) => !v)}>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{post.title}</div>
          <div className="flex items-center gap-2 mt-1">
            {keyword && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{keyword.keyword}</span>}
            {post.publish_date && <span className="text-xs text-muted-foreground">{post.publish_date}</span>}
            <span className="text-xs text-muted-foreground">{doneChecks}/9 checks</span>
            {post.content && <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">Draft ready</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground hover:text-primary" onClick={handleGenerateDraft} disabled={loadingDraft}>
              {loadingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {post.content ? 'Regenerate' : 'Draft'}
            </Button>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <Select value={post.status} onValueChange={(v) => { onUpdate({ status: v as BlogPostStatus }) }}>
              <SelectTrigger className="h-7 w-[110px] text-xs">
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium capitalize', BLOG_STATUS_STYLES[post.status])}>{post.status}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="idea">Idea</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {post.url && <a href={post.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-primary"><ExternalLink className="h-3.5 w-3.5" /></a>}
          <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-muted/20 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(['seo', 'aeo', 'geo'] as const).map((section) => (
              <div key={section}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{section.toUpperCase()}</p>
                <div className="space-y-1.5">
                  {BLOG_CHECKS[section].map((c) => (
                    <button key={c.key} onClick={() => onUpdate({ [c.key]: !post[c.key] })} className="flex items-center gap-2 text-sm hover:text-foreground text-muted-foreground transition-colors w-full text-left">
                      {post[c.key] ? <CheckSquare className="h-4 w-4 text-green-500 shrink-0" /> : <Square className="h-4 w-4 shrink-0" />}
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {post.word_count != null && (
            <div className="text-xs text-muted-foreground">{post.word_count} / {post.target_wc} words</div>
          )}

          {post.content && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Generated Draft</p>
                <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans bg-background border border-border rounded-lg p-3 max-h-80 overflow-y-auto">{post.content}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Audit Tab ───────────────────────────────────────────────────────────────

function AuditTab({ brandId }: { brandId: string }) {
  const { items, isLoading, seedDefaults, updateItem, deleteItem } = useSeoAudit(brandId)

  const done = items.filter((i) => i.status === 'done').length
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center gap-3">
        <p className="font-medium">No audit items yet</p>
        <p className="text-sm text-muted-foreground">Load a standard SEO audit checklist to get started</p>
        <Button size="sm" onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending} className="gap-1.5">
          {seedDefaults.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Set up default SEO audit
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm font-medium tabular-nums">{done}/{items.length} done · {pct}%</span>
      </div>

      {AUDIT_CATEGORIES.map((cat) => {
        const catItems = items.filter((i) => i.category === cat)
        if (catItems.length === 0) return null
        return (
          <div key={cat}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{AUDIT_CATEGORY_LABELS[cat]}</h3>
            <div className="space-y-1.5">
              {catItems.map((item) => (
                <AuditItemRow key={item.id} item={item}
                  onStatusChange={(status) => updateItem.mutate({ id: item.id, patch: { status } })}
                  onDelete={() => deleteItem.mutate(item.id)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const AUDIT_STATUS_CYCLE: Record<SeoAuditStatus, SeoAuditStatus> = {
  not_done:    'in_progress',
  in_progress: 'done',
  done:        'not_done',
}

const AUDIT_STATUS_ICON: Record<SeoAuditStatus, string> = {
  not_done:    '○',
  in_progress: '◐',
  done:        '●',
}

const AUDIT_STATUS_COLOR: Record<SeoAuditStatus, string> = {
  not_done:    'text-muted-foreground',
  in_progress: 'text-amber-500',
  done:        'text-green-500',
}

function AuditItemRow({ item, onStatusChange, onDelete }: { item: SeoAuditItem; onStatusChange: (s: SeoAuditStatus) => void; onDelete: () => void }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 bg-card transition-colors', item.status === 'done' && 'opacity-60')}>
      <button onClick={() => onStatusChange(AUDIT_STATUS_CYCLE[item.status])} className={cn('text-base shrink-0 transition-colors', AUDIT_STATUS_COLOR[item.status])}>
        {AUDIT_STATUS_ICON[item.status]}
      </button>
      <span className={cn('flex-1 text-sm', item.status === 'done' && 'line-through')}>{item.issue}</span>
      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PRIORITY_STYLES[item.priority])}>{PRIORITY_LABELS[item.priority]}</span>
      <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  )
}

// ─── Reviews Tab ─────────────────────────────────────────────────────────────

function ReviewsTab({ brandId }: { brandId: string }) {
  const { snapshots, isLoading, logSnapshot, deleteSnapshot } = useReviewSnapshots(brandId)
  const [form, setForm] = useState({ platform: 'google', count: '', target: '' })
  const [adding, setAdding] = useState(false)

  const latestByPlatform = snapshots.reduce<Record<string, typeof snapshots[number]>>((acc, s) => {
    if (!acc[s.platform] || s.recorded_at > acc[s.platform].recorded_at) acc[s.platform] = s
    return acc
  }, {})

  async function handleLog() {
    if (!form.count) return
    try {
      await logSnapshot.mutateAsync({
        brand_id: brandId,
        platform: form.platform,
        count: parseInt(form.count),
        target: form.target ? parseInt(form.target) : null,
        recorded_at: new Date().toISOString().slice(0, 10),
      })
      setForm({ platform: 'google', count: '', target: '' })
      setAdding(false)
      toast.success('Review count logged')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Log your review counts monthly to track growth</p>
        <Button size="sm" onClick={() => setAdding((v) => !v)} variant={adding ? 'outline' : 'default'} className="gap-1.5">
          <Plus className="h-4 w-4" /> Log Count
        </Button>
      </div>

      {adding && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={(v) => setForm((f) => ({ ...f, platform: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="trustpilot">Trustpilot</SelectItem>
                  <SelectItem value="tripadvisor">Tripadvisor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Current count</Label>
              <Input type="number" placeholder="17" value={form.count} onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Target</Label>
              <Input type="number" placeholder="50" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleLog} disabled={logSnapshot.isPending}>{logSnapshot.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log'}</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {Object.keys(latestByPlatform).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(latestByPlatform).map(([platform, snap]) => {
            const pct = snap.target ? Math.min(100, Math.round((snap.count / snap.target) * 100)) : null
            return (
              <div key={platform} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground capitalize">{platform}</span>
                  <span className="text-xs text-muted-foreground">{snap.recorded_at}</span>
                </div>
                <div className="text-3xl font-bold">{snap.count.toLocaleString()}</div>
                {snap.target && (
                  <>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Target: {snap.target}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {snapshots.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Platform</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs">Count</th>
                <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs">Target</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Date</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {snapshots.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 capitalize font-medium">{s.platform}</td>
                  <td className="px-3 py-2.5 text-center font-mono">{s.count}</td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground font-mono">{s.target ?? '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.recorded_at}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button onClick={() => deleteSnapshot.mutate(s.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {snapshots.length === 0 && !adding && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center gap-2">
          <p className="font-medium">No review data yet</p>
          <p className="text-sm text-muted-foreground">Log your current review count to start tracking growth</p>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: 'keywords', label: 'Keywords' },
  { key: 'blog',     label: 'Blog Planner' },
  { key: 'audit',    label: 'Audit' },
  { key: 'reviews',  label: 'Reviews' },
]

export function SeoPage() {
  const { activeBrand } = useActiveBrand()
  const [tab, setTab] = useState<Tab>('keywords')

  if (!activeBrand) return <NoBrandSelected />

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">SEO</h1>
        <p className="mt-1 text-muted-foreground">
          Keyword tracking and content strategy for{' '}
          <span className="font-medium text-foreground">{activeBrand.name}</span>
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'keywords' && <KeywordsTab brandId={activeBrand.id} />}
      {tab === 'blog'     && <BlogTab brand={activeBrand} />}
      {tab === 'audit'    && <AuditTab brandId={activeBrand.id} />}
      {tab === 'reviews'  && <ReviewsTab brandId={activeBrand.id} />}
    </div>
  )
}
