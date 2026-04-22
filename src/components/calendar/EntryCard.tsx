import { memo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  APPROVAL_STATUS_DOT, CALENDAR_STATUS_BORDER, CALENDAR_STATUS_DOT,
} from '@/lib/statusTokens'
import { PlatformStack } from './PlatformStack'
import type { EntryGroup } from './entryGroups'

interface EntryCardProps {
  group: EntryGroup
  onClick: () => void
}

function EntryCardImpl({ group, onClick }: EntryCardProps) {
  const { representative: rep } = group
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: group.id })

  const approvalDot = rep.approval_status ? APPROVAL_STATUS_DOT[rep.approval_status] : null

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`cursor-pointer rounded border border-border border-l-4 ${CALENDAR_STATUS_BORDER[rep.status]} bg-card px-1.5 py-1 text-xs hover:bg-accent hover:-translate-y-[1px] hover:shadow-sm transition-all duration-150 select-none animate-in fade-in-0 slide-in-from-top-1`}
    >
      {/* Mobile: single row — status dot + title */}
      <div className="flex items-center gap-1.5 sm:hidden">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CALENDAR_STATUS_DOT[rep.status]}`} />
        <span className="text-foreground line-clamp-1 text-[11px] leading-tight flex-1">{rep.title}</span>
      </div>
      {/* Desktop: platform stack + metadata dots + title */}
      <div className="hidden sm:block">
        <div className="flex items-center gap-1.5">
          <PlatformStack platforms={group.platforms} />
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
