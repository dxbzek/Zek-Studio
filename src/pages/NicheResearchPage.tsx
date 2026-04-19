import { useState } from 'react'
import { TrendingUp, RefreshCw, ExternalLink, UserPlus, Loader2, Clock, Eye, Heart } from 'lucide-react'
import { useActiveBrand } from '@/stores/activeBrand'
import { NoBrandSelected } from '@/components/layout/NoBrandSelected'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNicheResearch } from '@/hooks/useNicheResearch'
import { useCompetitors } from '@/hooks/useCompetitors'
import { toast } from 'sonner'
import type { TopCreator, Platform } from '@/types'
import { formatDistanceToNow } from 'date-fns'

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  tiktok: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300',
  youtube: 'bg-red-500/10 text-red-600 dark:text-red-400',
  facebook: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  linkedin: 'bg-blue-700/10 text-blue-700 dark:text-blue-300',
}

function fmtNum(n: number | null | undefined): string | null {
  if (n == null || n === 0) return null
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
}

export function NicheResearchPage() {
  const { activeBrand } = useActiveBrand()
  const { results, fetchedAt, isLoading, refresh } = useNicheResearch(
    activeBrand?.id ?? null,
    activeBrand?.niche ?? null,
    activeBrand?.target_location ?? null,
  )

  const { runResearch } = useCompetitors(activeBrand?.id ?? null)
  const [addingCreator, setAddingCreator] = useState<string | null>(null)

  if (!activeBrand) return <NoBrandSelected />

  async function handleAddCompetitor(creator: TopCreator) {
    const key = `${creator.platform}:${creator.handle}`
    setAddingCreator(key)
    try {
      await runResearch.mutateAsync({ handle: creator.handle, platform: creator.platform as Platform })
      toast.success(`@${creator.handle} added as competitor`)
    } catch (err) {
      toast.error('Failed to add competitor', { description: (err as Error).message })
    } finally {
      setAddingCreator(null)
    }
  }

  async function handleRefresh() {
    try {
      const result = await refresh.mutateAsync()
      if (result.cached) {
        toast.info('Results are fresh — cache is less than 1 hour old.')
      } else {
        toast.success('Research updated')
      }
    } catch (err) {
      toast.error('Research failed', { description: (err as Error).message })
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow mb-1.5">Intelligence</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.025em' }}>Niche Research</h1>
          <p className="mt-1 text-muted-foreground">
            Trending topics and top creators for{' '}
            <span className="font-medium text-foreground">{activeBrand.niche}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {fetchedAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDistanceToNow(new Date(fetchedAt), { addSuffix: true })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refresh.isPending || isLoading}
            className="gap-1.5"
          >
            {refresh.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Researching…</>
              : <><RefreshCw className="h-3.5 w-3.5" /> {results ? 'Refresh' : 'Run Research'}</>
            }
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {!isLoading && !results && !refresh.isPending && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
            <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="font-medium">No research yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Click <strong>Run Research</strong> to discover trending topics and top creators for <strong>{activeBrand.niche}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {(isLoading || refresh.isPending) && !results && (
        <div className="space-y-6 animate-pulse">
          <div className="space-y-3">
            <div className="h-5 w-40 bg-muted rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-36 rounded-xl bg-muted" />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-muted" />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <>
          {/* Trending Topics */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">
              Trending Topics
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({results.trending_topics.length})
              </span>
            </h2>
            {results.trending_topics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trending topics found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.trending_topics.map((topic, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">
                        {topic.title}
                      </p>
                      {topic.url && (
                        <a
                          href={topic.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                      {topic.summary}
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                      <span className="text-xs text-muted-foreground truncate">{topic.source}</span>
                      {topic.published_at && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(topic.published_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Top Creators */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">
              Top Creators
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({results.top_creators.length})
              </span>
            </h2>
            {results.top_creators.length === 0 ? (
              <p className="text-sm text-muted-foreground">No creators found. Try refreshing.</p>
            ) : (
              <div className="space-y-2">
                {results.top_creators.map((creator, i) => {
                  const key = `${creator.platform}:${creator.handle}`
                  const isAdding = addingCreator === key
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">@{creator.handle}</span>
                          <Badge
                            variant="secondary"
                            className={`text-xs px-1.5 py-0 ${PLATFORM_COLORS[creator.platform] ?? ''}`}
                          >
                            {PLATFORM_LABELS[creator.platform] ?? creator.platform}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {fmtNum(creator.top_post_views) && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Eye className="h-3 w-3" />
                              {fmtNum(creator.top_post_views)} views
                            </span>
                          )}
                          {fmtNum(creator.top_post_likes) && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Heart className="h-3 w-3" />
                              {fmtNum(creator.top_post_likes)} likes
                            </span>
                          )}
                          {creator.top_post_date && (
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(creator.top_post_date), { addSuffix: true })}
                            </span>
                          )}
                          {creator.bio && !creator.top_post_views && !creator.top_post_likes && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {creator.bio}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(creator.top_post_url ?? creator.url) && (
                          <a
                            href={creator.top_post_url ?? creator.url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title={creator.top_post_url ? 'View top post' : 'View profile'}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => handleAddCompetitor(creator)}
                          disabled={isAdding}
                        >
                          {isAdding
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Adding…</>
                            : <><UserPlus className="h-3.5 w-3.5" /> Add competitor</>
                          }
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
