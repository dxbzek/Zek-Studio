import { useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Plus, Trash2, BookmarkX } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveBrand } from '@/stores/activeBrand'
import { NoBrandSelected } from '@/components/layout/NoBrandSelected'
import { useCompetitors, useCompetitorPosts, useSavedHooks } from '@/hooks/useCompetitors'
import { PostCard } from '@/components/competitors/PostCard'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { PLATFORMS } from '@/types'
import type { Platform, CompetitorPost } from '@/types'

const addSchema = z.object({
  handle: z.string().min(1, 'Handle is required'),
  platform: z.enum(['instagram', 'tiktok', 'facebook', 'youtube']),
})

type AddForm = z.infer<typeof addSchema>
type SortKey = 'engagement' | 'views' | 'likes' | 'recency'

const SORT_LABELS: Record<SortKey, string> = {
  engagement: 'Engagement %',
  views: 'Views',
  likes: 'Likes',
  recency: 'Recent',
}

function sortPosts(posts: CompetitorPost[], key: SortKey): CompetitorPost[] {
  return [...posts].sort((a, b) => {
    switch (key) {
      case 'views':
        return (b.views ?? 0) - (a.views ?? 0)
      case 'likes':
        return (b.likes ?? 0) - (a.likes ?? 0)
      case 'engagement': {
        const er = (p: CompetitorPost) => {
          const i = (p.likes ?? 0) + (p.comments ?? 0)
          return p.views ? i / p.views : 0
        }
        return er(b) - er(a)
      }
      case 'recency':
        return (b.posted_at ?? b.created_at).localeCompare(a.posted_at ?? a.created_at)
    }
  })
}

// LinkedIn is excluded — scrapers are unreliable and frequently broken
const SUPPORTED_PLATFORMS = PLATFORMS.filter((p) => p.value !== 'linkedin')

/** Strip profile URLs down to bare username so @nike and instagram.com/nike both work */
function extractUsername(input: string): string {
  const trimmed = input.trim()
  try {
    if (trimmed.startsWith('http')) {
      const url = new URL(trimmed)
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length > 0) return parts[0].replace(/^@/, '')
    }
  } catch { /* not a URL */ }
  return trimmed.replace(/^@/, '')
}

export function CompetitorResearchPage() {
  const { activeBrand } = useActiveBrand()
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('engagement')
  const [savingPostId, setSavingPostId] = useState<string | null>(null)
  const [transcribingPostId, setTranscribingPostId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(10)

  const { competitors, runResearch, deleteCompetitor, transcribePost } = useCompetitors(activeBrand?.id ?? null)
  const { data: posts = [], isLoading: postsLoading } = useCompetitorPosts(
    activeBrand?.id ?? null,
    selectedCompetitorId,
  )
  const { savedHooks, saveHook, deleteHook } = useSavedHooks(activeBrand?.id ?? null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AddForm>({
    resolver: zodResolver(addSchema),
    defaultValues: { handle: '', platform: 'instagram' },
  })

  const watchedPlatform = watch('platform')

  if (!activeBrand) return <NoBrandSelected />

  async function onAdd(values: AddForm) {
    try {
      const result = await runResearch.mutateAsync({ handle: extractUsername(values.handle), platform: values.platform })
      const count = result.posts?.length ?? 0
      toast.success(`Scraped @${values.handle.replace(/^@/, '')} — ${count} posts imported`)
      reset({ handle: '', platform: values.platform })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleSaveHook(text: string, postId: string, platform: Platform) {
    setSavingPostId(postId)
    try {
      await saveHook.mutateAsync({ text, source_post_id: postId, platform })
      toast.success('Hook saved!')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingPostId(null)
    }
  }

  async function handleDeleteCompetitor(id: string) {
    try {
      await deleteCompetitor.mutateAsync(id)
      if (selectedCompetitorId === id) setSelectedCompetitorId(null)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleTranscribe(postId: string, videoUrl: string) {
    setTranscribingPostId(postId)
    try {
      await transcribePost.mutateAsync({ postId, videoUrl })
      toast.success('Script transcribed!')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setTranscribingPostId(null)
    }
  }

  const savedPostIds = new Set(
    savedHooks.map((h) => h.source_post_id).filter(Boolean) as string[],
  )
  const sortedPosts = sortPosts(posts, sortKey)
  const visiblePosts = sortedPosts.slice(0, visibleCount)

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="eyebrow mb-1.5">Intelligence</div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.025em' }}>Competitor Research</h1>
        <p className="mt-1 text-muted-foreground">
          Analyzing competitors for{' '}
          <span className="font-medium text-foreground">{activeBrand.name}</span>
        </p>
      </div>

      <Tabs defaultValue="research">
        <TabsList>
          <TabsTrigger value="research">Research</TabsTrigger>
          <TabsTrigger value="saved">
            Saved Hooks
            {savedHooks.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary leading-none">
                {savedHooks.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Research Tab ──────────────────────────────────────────────────────── */}
        <TabsContent value="research" className="mt-4 space-y-5">
          {/* Add competitor form */}
          <form
            onSubmit={handleSubmit(onAdd)}
            className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-border bg-card"
          >
            <div className="space-y-1.5 min-w-[180px] flex-1">
              <Label htmlFor="handle">Competitor handle</Label>
              <Input id="handle" placeholder="@username or handle" {...register('handle')} />
              {errors.handle && (
                <p className="text-xs text-destructive">{errors.handle.message}</p>
              )}
            </div>

            <div className="space-y-1.5 w-[160px]">
              <Label>Platform</Label>
              <Select
                value={watchedPlatform}
                onValueChange={(v) =>
                  setValue('platform', v as AddForm['platform'], { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_PLATFORMS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.platform && (
                <p className="text-xs text-destructive">{errors.platform.message}</p>
              )}
            </div>

            <Button type="submit" disabled={runResearch.isPending} className="gap-1.5">
              {runResearch.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Scraping…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Scrape
                </>
              )}
            </Button>
          </form>

          {/* Competitor filter chips */}
          {competitors.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => { setSelectedCompetitorId(null); setVisibleCount(10) }}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                  selectedCompetitorId === null
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted',
                )}
              >
                All
              </button>
              {competitors.map((c) => (
                <div key={c.id} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSelectedCompetitorId(c.id === selectedCompetitorId ? null : c.id)
                      setVisibleCount(10)
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                      c.id === selectedCompetitorId
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:bg-muted',
                    )}
                    title={c.last_scraped_at ? `Scraped ${formatDistanceToNow(parseISO(c.last_scraped_at), { addSuffix: true })}` : 'Never scraped'}
                  >
                    @{c.handle}
                    <span className="opacity-60 text-xs capitalize ml-1.5">{c.platform}</span>
                  </button>
                  <button
                    onClick={() => handleDeleteCompetitor(c.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove competitor"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Sort controls — show whenever there are competitors */}
          {competitors.length > 0 && (
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => { setSortKey(key); setVisibleCount(10) }}
                  className={cn(
                    'text-sm px-3 py-1 rounded-full border transition-colors',
                    sortKey === key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-muted',
                  )}
                >
                  {SORT_LABELS[key]}
                </button>
              ))}
              {posts.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {posts.length} post{posts.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {/* Post grid */}
          {postsLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedPosts.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visiblePosts.map((post) => {
                  const competitor = competitors.find((c) => c.id === post.competitor_id)
                  return (
                    <PostCard
                      key={post.id}
                      post={post}
                      handle={competitor?.handle ?? 'unknown'}
                      onSaveHook={handleSaveHook}
                      isSaving={savingPostId === post.id}
                      alreadySaved={savedPostIds.has(post.id)}
                      onTranscribe={handleTranscribe}
                      isTranscribing={transcribingPostId === post.id}
                    />
                  )
                })}
              </div>
              {visibleCount < sortedPosts.length && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount((n) => n + 10)}
                  >
                    See more ({sortedPosts.length - visibleCount} remaining)
                  </Button>
                </div>
              )}
            </div>
          ) : competitors.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center gap-2">
              <p className="font-medium">No competitors yet</p>
              <p className="text-sm text-muted-foreground">
                Enter a competitor handle above and click Scrape
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center gap-2">
              <p className="font-medium">No posts for this competitor</p>
              <p className="text-sm text-muted-foreground">
                Try scraping them again or select a different filter
              </p>
            </div>
          )}
        </TabsContent>

        {/* ── Saved Hooks Tab ───────────────────────────────────────────────────── */}
        <TabsContent value="saved" className="mt-4">
          {savedHooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center gap-2">
              <p className="font-medium">No saved hooks yet</p>
              <p className="text-sm text-muted-foreground">
                Click "Save hook" on any competitor post to add it here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedHooks.map((hook) => (
                <div key={hook.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <p className="text-sm leading-relaxed">{hook.text}</p>
                  <div className="flex items-center justify-between gap-2">
                    {hook.platform && (
                      <span className="text-xs text-muted-foreground capitalize bg-muted px-2 py-0.5 rounded-full">
                        {hook.platform}
                      </span>
                    )}
                    <button
                      onClick={() => deleteHook.mutate(hook.id)}
                      className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove hook"
                    >
                      <BookmarkX className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
