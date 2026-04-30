import { useState, useRef, useEffect, useMemo } from 'react'
import { ExternalLink, ChevronDown, ChevronUp, RefreshCw, Sparkles } from 'lucide-react'
import { useActiveBrand } from '@/stores/activeBrand'
import { NoBrandSelected } from '@/components/layout/NoBrandSelected'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { useGenerator } from '@/hooks/useGenerator'
import { useNicheResearch } from '@/hooks/useNicheResearch'
import { useCompetitorPosts } from '@/hooks/useCompetitors'
import { fmtCompactOrNull } from '@/lib/formatting'
import { PLATFORM_BRAND } from '@/lib/platformBrand'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { PLATFORMS, GENERATOR_PLATFORMS, CONTENT_THEMES } from '@/types'
import type {
  ContentTheme, ContentTone, ContentType, Platform, GeneratorPlatform, GenerateSource,
  GeneratedContent, TrendingTopic, CompetitorPost,
} from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const TONES: { value: ContentTone; label: string }[] = [
  { value: 'professional',  label: 'Professional' },
  { value: 'casual',        label: 'Conversational' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'luxurious',     label: 'Luxurious' },
  { value: 'educational',   label: 'Educational' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'urgent',        label: 'Urgency / FOMO' },
]

const PACKAGE_SECTIONS: { label: string; contentType: ContentType; color: string }[] = [
  { label: 'Hook',            contentType: 'hook',    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  { label: 'Caption',         contentType: 'caption', color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
  { label: 'Video Script',    contentType: 'script',  color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  { label: 'Call to Action',  contentType: 'cta',     color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
]

// Generator platforms include "meta" (a Facebook+Instagram duo) which isn't a
// real Platform value, so it gets its own gradient chip. Everything else is
// delegated to the canonical PLATFORM_BRAND map.
const META_CHIP = 'bg-gradient-to-r from-pink-500/10 to-blue-500/10 text-pink-600 dark:text-pink-400'
function platformChip(platform: string): string {
  if (platform === 'meta') return META_CHIP
  return PLATFORM_BRAND[platform as Platform]?.chip ?? ''
}

const TONE_COLORS: Record<string, string> = {
  professional:  'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  casual:        'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  authoritative: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  luxurious:     'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  educational:   'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  inspirational: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  urgent:        'bg-red-500/10 text-red-600 dark:text-red-400',
}

const THEME_COLORS: Record<string, string> = {
  property_tour:     'bg-green-500/10 text-green-600 dark:text-green-400',
  market_update:     'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  agent_recruitment: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  client_story:      'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  investment_tips:   'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  behind_scenes:     'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  new_launch:        'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400',
  area_spotlight:    'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
}

const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  meta: 2200, instagram: 2200, tiktok: 2200,
  facebook: 63206, linkedin: 3000, youtube: 5000,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtNum = fmtCompactOrNull

function getThemeLabel(type: string): string {
  return CONTENT_THEMES.find((t) => t.value === type)?.label ?? type
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AutoTextarea({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Cap auto-grow so a long paste doesn't push the submit button off-screen
  // on mobile; switch to internal scrolling past the cap.
  const MAX_PX = 420
  useEffect(() => {
    if (!ref.current) return
    ref.current.style.height = 'auto'
    const next = Math.min(ref.current.scrollHeight, MAX_PX)
    ref.current.style.height = `${next}px`
    ref.current.style.overflowY = ref.current.scrollHeight > MAX_PX ? 'auto' : 'hidden'
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      className={`w-full resize-none bg-transparent border border-transparent rounded-md focus:border-border/60 focus:bg-muted/20 px-1.5 py-1 -mx-1.5 outline-none ring-0 focus:ring-0 transition-colors leading-relaxed ${className ?? ''}`}
    />
  )
}

function CharCount({ text, platform }: { text: string; platform: string }) {
  const limit = PLATFORM_CHAR_LIMITS[platform]
  const len = text.length
  const pct = limit ? len / limit : 0
  const color = pct > 1 ? 'text-destructive font-medium' : pct > 0.9 ? 'text-amber-500' : 'text-muted-foreground'
  return (
    <span className={`text-[11px] ${color}`}>
      {len.toLocaleString()}{limit ? ` / ${limit.toLocaleString()}` : ''} chars
    </span>
  )
}

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
  const isPackage = item.output.length === 4

  async function handleCopy(text: string, idx: number) {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  return (
    <div className="premium-card rounded-xl ring-1 ring-border/80">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.brief}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${THEME_COLORS[item.type] ?? 'bg-muted text-muted-foreground'}`}>
              {getThemeLabel(item.type)}
            </Badge>
            <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${platformChip(item.platform)}`}>
              {[...PLATFORMS, ...GENERATOR_PLATFORMS].find((p) => p.value === item.platform)?.label ?? item.platform}
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
              <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium mt-0.5 ${
                isPackage ? (PACKAGE_SECTIONS[idx]?.color ?? 'bg-muted text-muted-foreground') : 'bg-muted text-muted-foreground'
              }`}>
                {isPackage ? (PACKAGE_SECTIONS[idx]?.label ?? `${idx + 1}`) : idx + 1}
              </span>
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
  const { generate, history, saveToCalendar, saveHook, loadMore, historyLimit } = useGenerator(activeBrand?.id ?? null)
  const { results: nicheResults } = useNicheResearch(
    activeBrand?.id ?? null,
    activeBrand?.niche ?? null,
    activeBrand?.target_location ?? null,
  )
  const { data: allPosts = [] } = useCompetitorPosts(activeBrand?.id ?? null, null, { staleTime: 0, refetchOnMount: true })

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
  const [theme, setTheme] = useState<ContentTheme>('property_tour')
  const [platform, setPlatform] = useState<GeneratorPlatform>('meta')
  const [tone, setTone] = useState<ContentTone>('professional')
  const [latestResult, setLatestResult] = useState<GeneratedContent | null>(null)
  const [editedOutput, setEditedOutput] = useState<string[]>([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [calendarDate, setCalendarDate] = useState<Record<number, string>>({})
  const [showCalendar, setShowCalendar] = useState<Record<number, boolean>>({})
  const [savingCalendarIndex, setSavingCalendarIndex] = useState<number | null>(null)
  const [historySearch, setHistorySearch] = useState('')

  const topRef = useRef<HTMLDivElement>(null)

  if (!activeBrand) return <NoBrandSelected />

  function updateOutput(index: number, value: string) {
    setEditedOutput((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

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
        comments: selectedPost.comments,
        shares: selectedPost.shares,
        platform: selectedPost.platform,
        transcript: selectedPost.transcript ? selectedPost.transcript.slice(0, 400) : null,
      }
    } else {
      if (!manualBrief.trim()) { toast.error('Enter a brief first'); return }
      source = { type: 'manual', brief: manualBrief }
    }
    try {
      const record = await generate.mutateAsync({ theme, platform, tone, source })
      setLatestResult(record)
      setEditedOutput([...record.output])
      setCopiedIndex(null)
      setCalendarDate({})
      setShowCalendar({})
    } catch (err) {
      toast.error('Generation failed', { description: (err as Error).message })
    }
  }

  function handleClear() {
    setLatestResult(null)
    setEditedOutput([])
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function handleCopy(text: string, index: number) {
    await navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 1500)
  }

  async function handleSaveHook(text: string) {
    try {
      await saveHook.mutateAsync({ text, platform })
      toast.success('Hook saved')
    } catch (err) {
      toast.error('Failed to save hook', { description: (err as Error).message })
    }
  }

  async function handleSaveToCalendar(text: string, index: number) {
    if (!calendarDate[index]) { toast.error('Pick a date first'); return }
    if (!latestResult) return
    setSavingCalendarIndex(index)
    const section = PACKAGE_SECTIONS[index]
    try {
      await saveToCalendar.mutateAsync({
        output: text,
        theme: latestResult.type,
        platform: latestResult.platform as Platform,
        generatedContentId: latestResult.id,
        scheduledDate: calendarDate[index],
        sectionContentType: section?.contentType,
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
  const isPackageResult = latestResult && editedOutput.length === 4

  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return historyItems
    const q = historySearch.toLowerCase()
    return historyItems.filter((item) =>
      item.brief.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q) ||
      item.tone.toLowerCase().includes(q)
    )
  }, [historyItems, historySearch])

  return (
    <div className="p-6 space-y-6" ref={topRef}>
      {/* Header */}
      <div>
        <div className="eyebrow mb-1.5">Create</div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.025em' }}>AI Content Generator</h1>
        <p className="mt-1 text-muted-foreground">
          Generating for{' '}
          <span className="font-medium text-foreground">{activeBrand.name}</span>
          {' '}· {activeBrand.niche}
        </p>
      </div>

      {/* Source Mode Tabs */}
      <div className="premium-card rounded-xl ring-1 ring-border/80 overflow-hidden">
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

        <div className="p-4">
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
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge
                        variant="secondary"
                        className={`text-xs px-1.5 py-0 ${platformChip(post.platform)}`}
                      >
                        {[...PLATFORMS, ...GENERATOR_PLATFORMS].find((p) => p.value === post.platform)?.label ?? post.platform}
                      </Badge>
                      {fmtNum(post.views) && (
                        <span className="text-xs text-muted-foreground">{fmtNum(post.views)} views</span>
                      )}
                      {fmtNum(post.likes) && (
                        <span className="text-xs text-muted-foreground">{fmtNum(post.likes)} likes</span>
                      )}
                      {fmtNum(post.comments) && (
                        <span className="text-xs text-muted-foreground">{fmtNum(post.comments)} comments</span>
                      )}
                      {post.views && post.views > 0 && (post.likes ?? 0) + (post.comments ?? 0) > 0 && (
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          {(((post.likes ?? 0) + (post.comments ?? 0)) / post.views * 100).toFixed(1)}% eng
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {sourceMode === 'manual' && (
            <div className="space-y-1">
              <Textarea
                placeholder="What's the post about? A topic, an angle, or a rough hook works."
                value={manualBrief}
                onChange={(e) => setManualBrief(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleGenerate()
                }}
                rows={4}
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground text-right">⌘↵ to generate</p>
            </div>
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="premium-card rounded-xl ring-1 ring-border/80 p-5 space-y-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-500">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Content Theme</label>
          <p className="text-xs text-muted-foreground">Each theme generates a full package: Hook · Caption · Video Script · Call to Action</p>
          <div className="flex gap-1.5 flex-wrap mt-1">
            {CONTENT_THEMES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                title={opt.desc}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  theme === opt.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {CONTENT_THEMES.find((t) => t.value === theme) && (
            <p className="text-xs text-muted-foreground">
              {CONTENT_THEMES.find((t) => t.value === theme)!.desc}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Tone</label>
          <SegmentedControl options={TONES} value={tone} onChange={setTone} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Platform</label>
          <SegmentedControl options={GENERATOR_PLATFORMS} value={platform} onChange={setPlatform} />
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generate.isPending}
          size="lg"
          className="w-full gap-2 text-[13.5px] font-semibold"
        >
          {generate.isPending ? (
            <>
              <span className="h-3.5 w-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
              Generating package…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Generate content package
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {latestResult && isPackageResult && (() => {
        const [hook, caption, script, cta] = editedOutput
        const combinedPost = [hook, caption, cta].filter(Boolean).join('\n\n')

        return (
          <section className="space-y-3">
            {/* Results header */}
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold">Your Content</h2>
              <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${THEME_COLORS[latestResult.type] ?? 'bg-muted text-muted-foreground'}`}>
                {getThemeLabel(latestResult.type)}
              </Badge>
              <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${platformChip(latestResult.platform)}`}>
                {[...PLATFORMS, ...GENERATOR_PLATFORMS].find((p) => p.value === latestResult.platform)?.label ?? latestResult.platform}
              </Badge>
              <Badge variant="secondary" className={`text-xs px-1.5 py-0 ${TONE_COLORS[latestResult.tone] ?? ''}`}>
                {latestResult.tone}
              </Badge>
              <div className="ml-auto flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={handleGenerate}
                  disabled={generate.isPending}
                >
                  <RefreshCw className={`h-3 w-3 ${generate.isPending ? 'animate-spin' : ''}`} />
                  {generate.isPending ? 'Regenerating…' : 'Regenerate'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={handleClear}
                  disabled={generate.isPending}
                >
                  Start over
                </Button>
              </div>
            </div>

            {/* Post card: Hook + Caption + CTA */}
            <div className="premium-card rounded-xl ring-1 ring-border/80 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Post</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs text-muted-foreground"
                  onClick={() => handleSaveHook(hook)}
                  disabled={saveHook.isPending}
                >
                  {saveHook.isPending ? 'Saving…' : 'Save hook'}
                </Button>
              </div>

              {/* Hook */}
              <div className="space-y-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-orange-500">Hook</span>
                <AutoTextarea
                  value={hook}
                  onChange={(v) => updateOutput(0, v)}
                  className="text-sm font-medium"
                />
              </div>

              {/* Caption */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-teal-500">Caption</span>
                  <CharCount text={caption} platform={platform} />
                </div>
                <AutoTextarea
                  value={caption}
                  onChange={(v) => updateOutput(1, v)}
                  className="text-sm"
                />
              </div>

              {/* CTA */}
              <div className="space-y-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-amber-500">Call to Action</span>
                <AutoTextarea
                  value={cta}
                  onChange={(v) => updateOutput(3, v)}
                  className="text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 justify-end flex-wrap pt-1 border-t border-border">
                {showCalendar[0] ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={calendarDate[0] ?? ''}
                      onChange={(e) => setCalendarDate((prev) => ({ ...prev, 0: e.target.value }))}
                      className="h-7 text-xs border border-border rounded px-2 bg-background text-foreground"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleSaveToCalendar(combinedPost, 0)}
                      disabled={savingCalendarIndex === 0 || !calendarDate[0]}
                    >
                      {savingCalendarIndex === 0 ? 'Scheduling…' : 'Schedule'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowCalendar((prev) => ({ ...prev, 0: false }))}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowCalendar((prev) => ({ ...prev, 0: true }))}>
                    Add to Calendar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleCopy(combinedPost, 0)}
                >
                  {copiedIndex === 0 ? 'Copied!' : 'Copy Post'}
                </Button>
              </div>
            </div>

            {/* Video Script card */}
            <div className="premium-card rounded-xl ring-1 ring-border/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Video Script</span>
                <CharCount text={script} platform={platform} />
              </div>
              <AutoTextarea
                value={script}
                onChange={(v) => updateOutput(2, v)}
                className="text-sm text-foreground"
              />
              <div className="flex items-center gap-2 justify-end pt-1 border-t border-border">
                {showCalendar[2] ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={calendarDate[2] ?? ''}
                      onChange={(e) => setCalendarDate((prev) => ({ ...prev, 2: e.target.value }))}
                      className="h-7 text-xs border border-border rounded px-2 bg-background text-foreground"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleSaveToCalendar(script, 2)}
                      disabled={savingCalendarIndex === 2 || !calendarDate[2]}
                    >
                      {savingCalendarIndex === 2 ? 'Scheduling…' : 'Schedule'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowCalendar((prev) => ({ ...prev, 2: false }))}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowCalendar((prev) => ({ ...prev, 2: true }))}>
                    Add to Calendar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleCopy(script, 2)}
                >
                  {copiedIndex === 2 ? 'Copied!' : 'Copy Script'}
                </Button>
              </div>
            </div>
          </section>
        )
      })()}

      {/* History */}
      {historyItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-semibold">
              History
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredHistory.length}{historySearch ? ` of ${historyItems.length}` : ''})
              </span>
            </h2>
            <Input
              placeholder="Search history…"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="h-7 w-full sm:w-44 text-xs sm:ml-auto"
            />
          </div>
          {filteredHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No results for "{historySearch}"</p>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map((item) => (
                <HistoryItem key={item.id} item={item} />
              ))}
              {!historySearch && historyItems.length === historyLimit && (
                <div className="pt-1 text-center">
                  <Button variant="ghost" size="sm" className="text-xs" onClick={loadMore}>
                    Load more
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
