import { useGeneratedContent } from '@/hooks/useCalendar'
import { PLATFORM_BRAND } from '@/lib/platformBrand'
import type { Platform } from '@/types'

export function GeneratedContentPreview({ id }: { id: string }) {
  const { data, isLoading } = useGeneratedContent(id)
  if (isLoading) return <p className="text-xs text-muted-foreground">Loading source…</p>
  if (!data) return null
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Generated from
      </p>
      <p className="text-sm text-foreground">{data.brief}</p>
      <div className="flex gap-1.5 flex-wrap mt-1">
        <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          {data.type}
        </span>
        <span className={`text-[11px] px-1.5 py-0.5 rounded ${PLATFORM_BRAND[data.platform as Platform].chip}`}>
          {data.platform}
        </span>
      </div>
    </div>
  )
}
