import { useState } from 'react'
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { useActiveBrand } from '@/stores/activeBrand'
import { NoBrandSelected } from '@/components/layout/NoBrandSelected'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useGenerator } from '@/hooks/useGenerator'
import { useNicheResearch } from '@/hooks/useNicheResearch'
import { useCompetitorPosts, useSavedHooks } from '@/hooks/useCompetitors'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { PLATFORMS } from '@/types'
import type {
  ContentType, ContentTone, Platform, GenerateSource,
  GeneratedContent, TrendingTopic, CompetitorPost,
} from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'hook', label: 'Hook' },
  { value: 'caption', label: 'Caption' },
  { value: 'idea', label: 'Idea' },
]

const TONES: { value: ContentTone; label: string }[] = [
  { value: 'casual', label: 'Casual' },
  { value: 'professional', label: 'Professional' },
  { value: 'humorous', label: 'Humorous' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'educational', label: 'Educational' },
]

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  tiktok: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300',
  youtube: 'bg-red-500/10 text-red-600 dark:text-red-400',
  facebook: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  linkedin: 'bg-blue-700/10 text-blue-700 dark:text-blue-300',
}

const TONE_COLORS: Record<string, string> = {
  casual: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  professional: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  humorous: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  inspirational: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  educational: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
}

const TYPE_COLORS: Record<string, string> = {
  hook: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  caption: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  idea: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number | null | undefined): string | null {
  if (n == null || n === 0) return null
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SegmentedControl<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            value === opt.value
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function HistoryItem({ item }: { item: GeneratedContent }) {
  const [expanded, setExpanded] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  async function handleCopy(text: string, idx: number) {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.brief}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${TYPE_COLORS[item.type] ?? ''}`}>
              {item.type}
            </Badge>
            <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${PLATFORM_COLORS[item.platform] ?? ''}`}>
              {PLATFORMS.find((p) => p.value === item.platform)?.label ?? item.platform}
            </Badge>
            <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${TONE_COLORS[item.tone] ?? ''}`}>
              {item.tone}
            </Badge>
            <span className="text-xs text-muted-foreground ml-auto">
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
        <span className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {item.output.map((text, idx) => (
            <div key={idx} className="px-4 py-3 flex items-start gap-3">
              <p className="text-sm flex-1 leading-relaxed whitespace-pre-wrap">{text}</p>
              <button
                type="button"
                onClick={() => handleCopy(text, idx)}
                className="shrink-0 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 transition-colors"
              >
                {copiedIdx === idx ? 'Copied' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type SourceMode = 'trending_topic' | 'competitor_post' | 'manual'

export function ContentGeneratorPage() {
  const { activeBrand } = useActiveBrand()
  const { generate, history, saveToCalendar } = useGenerator(activeBrand?.id ?? null)
  const { results: nicheResults } = useNicheResearch(
    activeBrand?.id ?? null,
    activeBrand?.niche ?? null,
    activeBrand?.target_location ?? null,
  )
  const { data: allPosts = [] } = useCompetitorPosts(activeBrand?.id ?? null)
  const { saveHook } = useSavedHooks(activeBrand?.id ?? null)

  // Sort posts by views then likes
  const topPosts = [...allPosts]
    .sort((a, b) => {
      const scoreA = (a.views ?? 0) > 0 ? (a.views ?? 0) : (a.likes ?? 0) * 10
      const scoreB = (b.views ?? 0) > 0 ? (b.views ?? 0) : (b.likes ?? 0) * 10
      return scoreB - scoreA
    })
    .slice(0, 10)

  const trendingTopics = nicheResults?.trending_topics?.slice(0, 8) ?? []

  const [sourceMode, setSourceMode] = useState<SourceMode>('trending_topic')
  const [selectedTopic, setSelectedTopic] = useState<TrendingTopic | null>(null)
  const [selectedPost, setSelectedPost] = useState<CompetitorPost | null>(null)
  const [manualBrief, setManualBrief] = useState('')
  const [type, setType] = useState<ContentType>('hook')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [tone, setTone] = useState<ContentTone>('casual')
  const [latestResult, setLatestResult] = useState<GeneratedContent | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [savingHookIndex, setSavingHookIndex] = useState<number | null>(null)
  const [calendarDate, setCalendarDate] = useState<Record<number, string>>({})
  const [showCalendar, setShowCalendar] = useState<Record<number, boolean>>({})
  const [savingCalendarIndex, setSavingCalendarIndex] = useState<number | null>(null)
  const [repurposedVariants, setRepurposedVariants] = useState<Record<number, { platform: string; output: string }[]>>({})
  const [repurposing, setRepurposing] = useState<number | null>(null)

  if (!activeBrand) return <NoBrandSelected />

  async function handleGenerate() {
    let source: GenerateSource
    if (sourceMode === 'trending_topic') {
      if (!selectedTopic) { toast.error('Select a trending topic first'); return }
      source = { type: 'trending_topic', title: selectedTopic.title, summary: selectedTopic.summary }
    } else if (sourceMode === 'competitor_post') {
      if (!selectedPost) { toast.error('Select a competitor post first'); return }
      source = {
        type: 'competitor_post',
        caption: selectedPost.caption,
        hook: selectedPost.hook,
        views: selectedPost.views,
        likes: selectedPost.likes,
      }
    } else {
      if (!manualBrief.trim()) { toast.error('Enter a brief first'); return }
      source = { type: 'manual', brief: manualBrief }
    }
    try {
      const record = await generate.mutateAsync({ type, platform, tone, source })
      setLatestResult(record)
      setCopiedIndex(null)
      setCalendarDate({})
      setShowCalendar({})
    } catch (err) {
      toast.error('Generation failed', { description: (err as Error).message })
    }
  }

  async function handleCopy(text: string, index: number) {
    await navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 1500)
  }

  async function handleSaveHook(text: string, index: number) {
    setSavingHookIndex(index)
    try {
      await saveHook.mutateAsync({ text, platform })
      toast.success('Hook saved')
    } catch (err) {
      toast.error('Failed to save hook', { description: (err as Error).message })
    } finally {
      setSavingHookIndex(null)
    }
  }

  async function handleRepurpose(index: number, content: string) {
    setRepurposing(index)
    try {
      const { data, error } = await supabase.functions.invoke('repurpose-content', {
        body: {
          brand_id: activeBrand?.id,
          original_content: content,
          original_platform: platform,
          content_type: type,
        },
      })
      if (error) throw error
      setRepurposedVariants((prev) => ({ ...prev, [index]: data.variants }))
    } catch (err) {
      toast.error('Repurpose failed', { description: (err as Error).message })
    } finally {
      setRepurposing(null)
    }
  }

  async function handleSaveToCalendar(text: string, index: number) {
    if (!calendarDate[index]) { toast.error('Pick a date first'); return }
    if (!latestResult) return
    setSavingCalendarIndex(index)
    try {
      await saveToCalendar.mutateAsync({
        output: text,
        type: latestResult.type,
        platform: latestResult.platform,
        generatedContentId: latestResult.id,
        scheduledDate: calendarDate[index],
      })
      toast.success(`Scheduled for ${calendarDate[index]}`)
      setShowCalendar((prev) => ({ ...prev, [index]: false }))
    } catch (err) {
      toast.error('Failed to schedule', { description: (err as Error).message })
    } finally {
      setSavingCalendarIndex(null)
    }
  }

  const historyItems = history.data ?? []

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Content Generator</h1>
        <p className="mt-1 text-muted-foreground">
          Generating content for{' '}
          <span className="font-medium text-foreground">{activeBrand.name}</span>
          {' '}· {activeBrand.niche}
        </p>
      </div>

      {/* Source Mode Tabs */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-border">
          {([
            { value: 'trending_topic', label: 'Trending Topics', count: trendingTopics.length },
            { value: 'competitor_post', label: 'Competitor Posts', count: topPosts.length },
            { value: 'manual', label: 'Manual Brief', count: null },
          ] as { value: SourceMode; label: string; count: number | null }[]).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSourceMode(tab.value)}
              className={`flex-1 px-4 py-3 text-sm font-medium text-left border-b-2 transition-colors ${
                sourceMode === tab.value
                  ? 'border-primary text-foreground bg-primary/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className={`ml-1.5 text-xs ${sourceMode === tab.value ? 'text-primary' : 'text-muted-foreground'}`}>
                  ({tab.count})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-4">

          {/* Trending Topics */}
          {sourceMode === 'trending_topic' && (
            trendingTopics.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No trending topics yet.{' '}
                <a href="/research" className="text-primary hover:underline">Run niche research</a>
                {' '}first to unlock this.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {trendingTopics.map((topic, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedTopic(topic)}
                    className={`text-left rounded-lg border p-3 transition-all ${
                      selectedTopic?.title === topic.title
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40 bg-background'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium line-clamp-2 flex-1">{topic.title}</p>
                      {topic.url && (
                        <a
                          href={topic.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 text-muted-foreground hover:text-foreground mt-0.5"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{topic.summary}</p>
                    <span className="text-xs text-muted-foreground mt-1 inline-block">{topic.source}</span>
                  </button>
                ))}
              </div>
            )
          )}

          {/* Competitor Posts */}
          {sourceMode === 'competitor_post' && (
            topPosts.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No competitor posts yet.{' '}
                <a href="/competitors" className="text-primary hover:underline">Add competitors</a>
                {' '}first to unlock this.
              </div>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {topPosts.map((post, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedPost(post)}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
                      selectedPost?.id === post.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40 bg-background'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {post.hook
                          ? post.hook.slice(0, 80)
                          : (post.caption ?? '').slice(0, 80)}
                        {((post.hook ?? post.caption ?? '').length > 80) ? '…' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="secondary"
                        className={`text-xs px-1.5 py-0 ${PLATFORM_COLORS[post.platform] ?? ''}`}
                      >
                        {PLATFORMS.find((p) => p.value === post.platform)?.label ?? post.platform}
                      </Badge>
                      {fmtNum(post.views) && (
                        <span className="text-xs text-muted-foreground">{fmtNum(post.views)} views</span>
                      )}
                      {fmtNum(post.likes) && (
                        <span className="text-xs text-muted-foreground">{fmtNum(post.likes)} likes</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {/* Manual Brief */}
          {sourceMode === 'manual' && (
            <Textarea
              placeholder="Describe your content idea… (e.g. 'Why Dubai real estate prices will keep rising in 2025')"
              value={manualBrief}
              onChange={(e) => setManualBrief(e.target.value)}
              rows={4}
              className="resize-none"
            />
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Content type</label>
          <SegmentedControl options={CONTENT_TYPES} value={type} onChange={setType} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Tone</label>
          <SegmentedControl options={TONES} value={tone} onChange={setTone} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Platform</label>
          <SegmentedControl options={PLATFORMS} value={platform} onChange={setPlatform} />
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generate.isPending}
          className="w-full"
        >
          {generate.isPending ? 'Generating…' : 'Generate 3 Variants'}
        </Button>
      </div>

      {/* Results */}
      {latestResult && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold">Generated Variants</h2>
            <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${TYPE_COLORS[latestResult.type] ?? ''}`}>
              {latestResult.type}
            </Badge>
            <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${PLATFORM_COLORS[latestResult.platform] ?? ''}`}>
              {PLATFORMS.find((p) => p.value === latestResult.platform)?.label ?? latestResult.platform}
            </Badge>
            <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${TONE_COLORS[latestResult.tone] ?? ''}`}>
              {latestResult.tone}
            </Badge>
          </div>

          <div className="space-y-3">
            {latestResult.output.map((text, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 text-xs font-bold text-muted-foreground mt-0.5 w-4">{idx + 1}</span>
                  <p className="text-sm flex-1 leading-relaxed whitespace-pre-wrap">{text}</p>
                </div>

                <div className="flex items-center gap-2 justify-end flex-wrap">
                  {latestResult.type === 'hook' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleSaveHook(text, idx)}
                      disabled={savingHookIndex === idx}
                    >
                      {savingHookIndex === idx ? 'Saving…' : 'Save as Hook'}
                    </Button>
                  )}

                  {showCalendar[idx] ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={calendarDate[idx] ?? ''}
                        onChange={(e) => setCalendarDate((prev) => ({ ...prev, [idx]: e.target.value }))}
                        className="h-7 text-xs border border-border rounded px-2 bg-background text-foreground"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleSaveToCalendar(text, idx)}
                        disabled={savingCalendarIndex === idx || !calendarDate[idx]}
                      >
                        {savingCalendarIndex === idx ? 'Scheduling…' : 'Schedule'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setShowCalendar((prev) => ({ ...prev, [idx]: false }))}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setShowCalendar((prev) => ({ ...prev, [idx]: true }))}
                    >
                      Save to Calendar
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleCopy(text, idx)}
                  >
                    {copiedIndex === idx ? 'Copied!' : 'Copy'}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={repurposing === idx}
                    onClick={() => handleRepurpose(idx, text)}
                  >
                    {repurposing === idx ? 'Repurposing…' : 'Repurpose'}
                  </Button>
                </div>

                {/* Repurposed variants */}
                {repurposedVariants[idx] && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Repurposed for:
                    </p>
                    {repurposedVariants[idx].map((v) => (
                      <div key={v.platform} className="flex items-start gap-2">
                        <span
                          className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded font-medium capitalize ${
                            PLATFORM_COLORS[v.platform] ?? 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {v.platform}
                        </span>
                        <p className="text-sm text-foreground flex-1 leading-relaxed">{v.output}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(v.output)
                            toast.success('Copied')
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* History */}
      {historyItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">
            History
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({historyItems.length})
            </span>
          </h2>
          <div className="space-y-2">
            {historyItems.map((item) => (
              <HistoryItem key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
