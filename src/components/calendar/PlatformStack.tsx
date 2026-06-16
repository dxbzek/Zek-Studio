import { memo } from 'react'
import type { Platform } from '@/types'
import { PlatformBadge } from '@/lib/platformBrand'
import { MAX_PLATFORM_BADGES } from './entryGroups'

function PlatformStackImpl({ platforms }: { platforms: Platform[] }) {
  const visible = platforms.slice(0, MAX_PLATFORM_BADGES)
  const overflow = platforms.length - visible.length
  // Spell the full platform list for assistive tech — the overlapping
  // badges and "+N" counter are purely visual.
  const label = platforms.length === 1
    ? `${platforms[0]} post`
    : `Platforms: ${platforms.join(', ')}`
  return (
    <div className="flex items-center" role="img" aria-label={label}>
      {visible.map((p, i) => (
        <div key={p} className={i > 0 ? '-ml-1 ring-1 ring-card rounded-sm' : ''} aria-hidden>
          <PlatformBadge platform={p} size="xs" />
        </div>
      ))}
      {overflow > 0 && (
        <span className="ml-1 font-mono text-[9px] font-medium text-muted-foreground tabular-nums" aria-hidden>
          +{overflow}
        </span>
      )}
    </div>
  )
}

export const PlatformStack = memo(PlatformStackImpl)
