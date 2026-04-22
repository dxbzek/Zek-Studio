import { useState } from 'react'
import { Eye, Heart, MessageCircle, Share2, Bookmark, BookmarkCheck, ExternalLink, Quote, Loader2, FileText, ChevronDown, ChevronUp, Video, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { CompetitorPost, Platform } from '@/types'

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function engagementRate(post: CompetitorPost): string {
  const interactions = (post.likes ?? 0) + (post.comments ?? 0)
  if (!post.views || post.views === 0) return '—'
  return `${((interactions / post.views) * 100).toFixed(2)}%`
}

const PLATFORM_BG: Record<string, string> = {
  instagram: 'from-pink-500/20 to-purple-500/20',
  tiktok: 'from-zinc-800/20 to-zinc-600/20',
  facebook: 'from-blue-600/20 to-blue-400/20',
  linkedin: 'from-blue-700/20 to-blue-500/20',
  youtube: 'from-red-600/20 to-red-400/20',
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
}

interface PostCardProps {
  post: CompetitorPost
  handle: string
  onSaveHook: (text: string, postId: string, platform: Platform) => void
  isSaving: boolean
  alreadySaved: boolean
  onTranscribe: (postId: string, videoUrl: string) => void
  isTranscribing: boolean
}

export function PostCard({ post, handle, onSaveHook, isSaving, alreadySaved, onTranscribe, isTranscribing }: PostCardProps) {
  const defaultHook = post.transcript
    ? (post.transcript.match(/^.{20,}?[.!?]/)?.[0] ?? post.transcript.slice(0, 180)).trim()
    : ''

  const [hookMode, setHookMode] = useState(false)
  const [hookText, setHookText] = useState(defaultHook)
  const [captionExpanded, setCaptionExpanded] = useState(false)
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  function handleSave() {
    if (hookText.trim()) {
      onSaveHook(hookText.trim(), post.id, post.platform as Platform)
      setHookMode(false)
    }
  }

  const showThumbnail = post.thumbnail_url && !imgFailed
  const hasVideo = !!post.video_url
  const hasTranscript = !!post.transcript

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      {/* Thumbnail */}
      {showThumbnail ? (
        <div className="aspect-video bg-muted relative overflow-hidden">
          <img
            src={post.thumbnail_url!}
            alt=""
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        </div>
      ) : (
        <div
          className={cn(
            'aspect-video flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br',
            PLATFORM_BG[post.platform] ?? 'from-muted to-muted',
          )}
        >
          {hasVideo
            ? <Video className="h-6 w-6 text-muted-foreground opacity-40" />
            : <Image className="h-6 w-6 text-muted-foreground opacity-40" />
          }
          <span className="text-xs text-muted-foreground opacity-50">
            {PLATFORM_LABEL[post.platform] ?? post.platform}
          </span>
        </div>
      )}

      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Handle + external link */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground truncate">@{handle}</span>
          {post.url && (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {/* Hook / first line — highlighted */}
        {defaultHook && (
          <div className="flex gap-1.5 rounded-lg bg-primary/8 px-2.5 py-2">
            <Quote className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary opacity-70" />
            <p className="text-xs font-medium leading-snug text-foreground line-clamp-2">
              {defaultHook}
            </p>
          </div>
        )}

        {/* Full caption (collapsible) */}
        {post.caption && post.caption !== defaultHook && (
          <>
            <p className={cn('text-xs text-muted-foreground leading-snug', !captionExpanded && 'line-clamp-3')}>
              {post.caption}
            </p>
            {post.caption.length > 120 && (
              <button
                className="text-xs text-primary hover:underline self-start -mt-1"
                onClick={() => setCaptionExpanded((v) => !v)}
              >
                {captionExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </>
        )}

        {/* Transcript section */}
        {hasTranscript && (
          <div className="rounded-lg border border-border bg-muted/40 p-2.5 space-y-1.5">
            <button
              onClick={() => setTranscriptExpanded((v) => !v)}
              className="flex items-center gap-1.5 w-full text-left"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-muted-foreground flex-1">Video script</span>
              {transcriptExpanded
                ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                : <ChevronDown className="h-3 w-3 text-muted-foreground" />
              }
            </button>
            {transcriptExpanded && (
              <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {post.transcript}
              </p>
            )}
          </div>
        )}

        {/* Metrics */}
        <div className="flex items-center gap-3 mt-auto pt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {formatNumber(post.views)}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" />
            {formatNumber(post.likes)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {formatNumber(post.comments)}
          </span>
          {post.shares != null && (
            <span className="flex items-center gap-1">
              <Share2 className="h-3.5 w-3.5" />
              {formatNumber(post.shares)}
            </span>
          )}
          <span className="ml-auto font-semibold text-foreground">{engagementRate(post)}</span>
        </div>

        {/* Hook save section */}
        {hookMode ? (
          <div className="space-y-2 pt-2 border-t border-border">
            <Textarea
              value={hookText}
              onChange={(e) => setHookText(e.target.value)}
              className="text-sm min-h-[64px] resize-none"
              placeholder="Edit hook text before saving…"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={handleSave}
                disabled={!hookText.trim() || isSaving}
              >
                {isSaving ? 'Saving…' : 'Save hook'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setHookMode(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 mt-1">
            {!hasTranscript && hasVideo && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 flex-1"
                onClick={() => onTranscribe(post.id, post.video_url!)}
                disabled={isTranscribing}
              >
                {isTranscribing
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Transcribing…</>
                  : <><FileText className="h-3.5 w-3.5" /> Get script</>
                }
              </Button>
            )}
            <Button
              size="sm"
              variant={alreadySaved ? 'secondary' : 'outline'}
              className="h-7 text-xs gap-1 flex-1"
              onClick={() => !alreadySaved && setHookMode(true)}
              disabled={alreadySaved}
            >
              {alreadySaved
                ? <><BookmarkCheck className="h-3.5 w-3.5" /> Saved</>
                : <><Bookmark className="h-3.5 w-3.5" /> Save hook</>
              }
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
