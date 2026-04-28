import { memo, type MouseEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  APPROVAL_STATUS_DOT, CALENDAR_STATUS_BORDER, CALENDAR_STATUS_DOT,
  CONTENT_FORMAT_CHIP, CONTENT_FORMAT_TINT,
} from '@/lib/statusTokens'
import { CONTENT_FORMATS } from '@/types'
import type { ContentFormat } from '@/types'
import { PlatformStack } from './PlatformStack'
import type { EntryGroup } from './entryGroups'

const FORMAT_SHORT: Record<ContentFormat, string> = Object.fromEntries(
  CONTENT_FORMATS.map((f) => [f.value, f.short]),
) as Record<ContentFormat, string>

interface EntryCardProps {
  group: EntryGroup
  onClick: () => void
  // When selectMode is on, click toggles selection instead of opening the
  // drawer; the card renders with a checkbox-like state indicator and drag
  // is disabled (too easy to misfire during multi-select).
  selectMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (groupId: string) => void
}

function EntryCardImpl({ group, onClick, selectMode, isSelected, onToggleSelect }: EntryCardProps) {
  const { representative: rep } = group
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: group.id, disabled: selectMode })

  const approvalDot = rep.approval_status ? APPROVAL_STATUS_DOT[rep.approval_status] : null
  const fmt = rep.format as ContentFormat | null
  const tintClass = fmt ? CONTENT_FORMAT_TINT[fmt] : 'bg-card'
  const formatPillClass = fmt ? CONTENT_FORMAT_CHIP[fmt] : ''

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation()
    if (selectMode && onToggleSelect) onToggleSelect(group.id)
    else onClick()
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...(selectMode ? {} : listeners)}
      {...(selectMode ? {} : attributes)}
      onClick={handleClick}
      className={`${selectMode ? 'cursor-pointer' : 'cursor-pointer'} rounded border border-l-4 ${CALENDAR_STATUS_BORDER[rep.status]} ${tintClass} px-1.5 py-1 text-xs ${selectMode && isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border'} hover:bg-accent hover:-translate-y-[1px] hover:shadow-sm transition-all duration-150 select-none animate-in fade-in-0 slide-in-from-top-1`}
    >
      {/* Mobile: single row — status dot + title */}
      <div className="flex items-center gap-1.5 sm:hidden">
        {selectMode && (
          <span
            className={`h-3 w-3 shrink-0 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}
            aria-hidden
          >
            {isSelected && <span className="text-[8px] leading-none text-primary-foreground">✓</span>}
          </span>
        )}
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CALENDAR_STATUS_DOT[rep.status]}`} />
        {fmt && (
          <span className={`shrink-0 px-1 rounded text-[9px] font-semibold leading-tight ${formatPillClass}`}>
            {FORMAT_SHORT[fmt]}
          </span>
        )}
        <span className="text-foreground line-clamp-1 text-[11px] leading-tight flex-1">{rep.title}</span>
      </div>
      {/* Desktop: platform stack + metadata dots + title */}
      <div className="hidden sm:block">
        <div className="flex items-center gap-1.5">
          {selectMode && (
            <span
              className={`h-3 w-3 shrink-0 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}
              aria-hidden
            >
              {isSelected && <span className="text-[8px] leading-none text-primary-foreground">✓</span>}
            </span>
          )}
          <PlatformStack platforms={group.platforms} />
          {fmt && (
            <span className={`shrink-0 px-1 rounded text-[9px] font-semibold leading-tight ${formatPillClass}`}>
              {FORMAT_SHORT[fmt]}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 shrink-0">
            {rep.assigned_talent && <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />}
            {approvalDot && <span className={`h-1.5 w-1.5 rounded-full ${approvalDot}`} />}
          </span>
        </div>
        <span className="block text-foreground line-clamp-1 mt-0.5 text-xs leading-tight">{rep.title}</span>
      </div>
    </div>
  )
}

export const EntryCard = memo(EntryCardImpl)

export function EntryCardOverlay({ group }: { group: EntryGroup }) {
  const { representative: rep } = group
  return (
    <div className={`rounded border border-border border-l-4 ${CALENDAR_STATUS_BORDER[rep.status]} bg-card px-1.5 py-1 text-xs shadow-lg`}>
      <div className="flex items-center gap-1.5 sm:hidden">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CALENDAR_STATUS_DOT[rep.status]}`} />
        <span className="text-foreground line-clamp-1 text-[11px] leading-tight flex-1">{rep.title}</span>
      </div>
      <div className="hidden sm:block">
        <PlatformStack platforms={group.platforms} />
        <span className="block text-foreground line-clamp-1 mt-0.5 text-xs leading-tight">{rep.title}</span>
      </div>
    </div>
  )
}
