import { memo, type MouseEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { MoreVertical } from 'lucide-react'
import {
  APPROVAL_STATUS_CHIP, CALENDAR_STATUS_BORDER, CALENDAR_STATUS_DOT,
  CONTENT_FORMAT_CHIP, CONTENT_FORMAT_TINT,
} from '@/lib/statusTokens'
import { CONTENT_FORMATS } from '@/types'
import type { ApprovalStatus, ContentFormat } from '@/types'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PlatformStack } from './PlatformStack'
import type { EntryGroup } from './entryGroups'

export type EntryQuickAction =
  | 'mark-published'
  | 'mark-scheduled'
  | 'move-plus-1d'
  | 'move-plus-7d'
  | 'delete'

// Short labels for the approval pill on cards (saves horizontal space).
const APPROVAL_SHORT: Record<ApprovalStatus, string> = {
  pending_review: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

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
  // Optional: quick actions surface as a ⋯ menu in the top-right of the
  // card. Skipped on overlays / drag previews.
  onQuickAction?: (group: EntryGroup, action: EntryQuickAction) => void
}

function EntryCardImpl({ group, onClick, selectMode, isSelected, onToggleSelect, onQuickAction }: EntryCardProps) {
  const { representative: rep } = group
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: group.id, disabled: selectMode })

  const approvalStatus = rep.approval_status as ApprovalStatus | null
  const approvalPillClass = approvalStatus ? APPROVAL_STATUS_CHIP[approvalStatus] : ''
  // Hover preview via the native title attribute. Cheap, no JS state, and
  // works on every device that has a pointer. Click for full editing.
  const previewParts: string[] = [rep.title]
  const fmtLabelForTitle = rep.format ? CONTENT_FORMATS.find((f) => f.value === rep.format)?.label : null
  if (fmtLabelForTitle) previewParts.push(`· ${fmtLabelForTitle}`)
  if (rep.script && rep.script.trim().length > 0) {
    const beats = rep.script.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 6)
    previewParts.push('', ...beats.map((b, i) => `${i + 1}. ${b}`))
  }
  const previewTitle = previewParts.join('\n')
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
      title={previewTitle}
      className={`group/card ${selectMode ? 'cursor-pointer' : 'cursor-pointer'} rounded border border-l-4 ${CALENDAR_STATUS_BORDER[rep.status]} ${tintClass} px-1.5 py-1 text-xs ${selectMode && isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border'} hover:bg-accent hover:-translate-y-[1px] hover:shadow-sm transition-all duration-150 select-none animate-in fade-in-0 slide-in-from-top-1`}
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
            {rep.assigned_talent && <span className="h-1.5 w-1.5 rounded-full bg-violet-400" title="Assigned" />}
            {onQuickAction && !selectMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover/card:opacity-100 focus:opacity-100 text-muted-foreground hover:text-foreground rounded p-0.5 transition-opacity"
                    aria-label="Quick actions"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[180px]" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onSelect={() => onQuickAction(group, 'mark-published')}>
                    Mark Published
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onQuickAction(group, 'mark-scheduled')}>
                    Mark Scheduled
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => onQuickAction(group, 'move-plus-1d')}>
                    Move +1 day
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onQuickAction(group, 'move-plus-7d')}>
                    Move +1 week
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => onQuickAction(group, 'delete')}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </span>
        </div>
        <div className="flex items-start gap-1.5 mt-0.5">
          {rep.reference_image_url && (
            <img
              src={rep.reference_image_url}
              alt=""
              className="shrink-0 w-7 h-7 rounded object-cover border border-border/60"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <span className="block text-foreground line-clamp-2 text-xs leading-tight flex-1">{rep.title}</span>
        </div>
        {approvalStatus && (
          <span className={`inline-block mt-1 px-1.5 py-px rounded text-[9px] font-semibold leading-tight ${approvalPillClass}`}>
            {APPROVAL_SHORT[approvalStatus]}
          </span>
        )}
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
