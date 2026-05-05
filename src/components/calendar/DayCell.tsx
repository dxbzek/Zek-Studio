import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { format, isSameDay, startOfDay } from 'date-fns'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { EntryCard } from './EntryCard'
import type { EntryQuickAction } from './EntryCard'
import type { EntryGroup } from './entryGroups'

const MAX_VISIBLE = 3

export type DaySelection = 'none' | 'some' | 'all'

interface DayCellProps {
  day: Date
  groups: EntryGroup[]
  isCurrentMonth: boolean
  tall?: boolean
  onGroupClick: (group: EntryGroup) => void
  onAddClick: () => void
  selectMode?: boolean
  selectedGroupIds?: Set<string>
  onToggleSelect?: (groupId: string) => void
  // Click on the day-number toggles every group in this day on/off.
  onToggleSelectDay?: (groupIds: string[], to: 'select' | 'deselect') => void
  onQuickAction?: (group: EntryGroup, action: EntryQuickAction) => void
}

export function DayCell({
  day, groups, isCurrentMonth, tall, onGroupClick, onAddClick,
  selectMode, selectedGroupIds, onToggleSelect, onToggleSelectDay, onQuickAction,
}: DayCellProps) {
  const dateStr = format(day, 'yyyy-MM-dd')
  const { isOver, setNodeRef } = useDroppable({ id: dateStr })
  const todayFlag = isSameDay(day, new Date())
  // "Gap" indicator: empty cell in the current month that's today or in the
  // future — i.e. a day the user could still fill. Past empty days and
  // out-of-month trailing/leading cells don't get the marker because they
  // aren't actionable.
  const isUpcomingEmpty =
    groups.length === 0 && isCurrentMonth && startOfDay(day) >= startOfDay(new Date())

  // Tri-state day-selection. Computed against the per-group selection set
  // so the day-number checkbox stays in sync with individual card toggles.
  const dayGroupIds = groups.map((g) => g.id)
  const selectedCount = selectMode && selectedGroupIds
    ? dayGroupIds.filter((id) => selectedGroupIds.has(id)).length
    : 0
  const daySelection: DaySelection =
    selectedCount === 0 ? 'none'
    : selectedCount === dayGroupIds.length ? 'all'
    : 'some'

  // Click-only popover for the "+N more" overflow. Hover-to-open kept
  // re-triggering as the cursor passed over the popover or as cells
  // re-rendered, so the menu would float open with no clear way to
  // dismiss it. Radix handles outside-click and Esc to close.
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <div
      ref={setNodeRef}
      onClick={() => { if (!selectMode) onAddClick() }}
      className={`group border-b border-r border-border p-1 sm:p-1.5 flex flex-col gap-1 transition-[background-color,box-shadow] duration-200 ease-out ${tall ? 'min-h-[180px] sm:min-h-[200px]' : 'min-h-[80px] sm:min-h-[110px]'} ${!isCurrentMonth ? 'bg-muted/20 hover:bg-muted/40' : selectMode ? '' : 'hover:bg-accent/30'} ${selectMode ? '' : 'cursor-pointer'} ${isOver ? 'bg-primary/10 ring-2 ring-primary/40 ring-inset shadow-[inset_0_0_0_2px_rgba(0,0,0,0.02)]' : ''}`}
    >
      <div className="flex items-center justify-between">
        {selectMode && groups.length > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelectDay?.(dayGroupIds, daySelection === 'all' ? 'deselect' : 'select')
            }}
            title={daySelection === 'all' ? 'Deselect day' : 'Select all on this day'}
            className={`group/day flex items-center gap-1 rounded-full px-1 py-0.5 transition-colors ${daySelection !== 'none' ? 'bg-primary/10' : 'hover:bg-accent'}`}
          >
            <span
              className={`h-3 w-3 shrink-0 rounded border flex items-center justify-center transition-colors ${
                daySelection === 'all'
                  ? 'bg-primary border-primary'
                  : daySelection === 'some'
                    ? 'bg-primary/60 border-primary'
                    : 'border-muted-foreground/40 group-hover/day:border-foreground/60'
              }`}
              aria-hidden
            >
              {daySelection === 'all' && (
                <span className="text-[8px] leading-none text-primary-foreground">✓</span>
              )}
              {daySelection === 'some' && (
                <span className="block h-[2px] w-1.5 bg-primary-foreground rounded" />
              )}
            </span>
            <span
              className={`font-mono text-[11px] sm:text-xs font-medium tabular-nums ${todayFlag ? 'text-primary' : 'text-muted-foreground'}`}
            >
              {format(day, 'd')}
            </span>
          </button>
        ) : (
          <span
            className={`font-mono text-[11px] sm:text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full tabular-nums ${todayFlag ? 'bg-primary text-primary-foreground' : isCurrentMonth ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}
          >
            {format(day, 'd')}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAddClick() }}
          className="sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-foreground text-sm leading-none h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-opacity"
          aria-label="Add entry"
        >
          +
        </button>
      </div>
      {isUpcomingEmpty && (
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground self-start px-1 py-0.5 rounded border border-dashed border-border">
          No post
        </span>
      )}
      {groups.slice(0, MAX_VISIBLE).map((grp) => (
        <EntryCard
          key={grp.id}
          group={grp}
          onClick={() => onGroupClick(grp)}
          selectMode={selectMode}
          isSelected={selectedGroupIds?.has(grp.id)}
          onToggleSelect={onToggleSelect}
          onQuickAction={onQuickAction}
        />
      ))}
      {groups.length > MAX_VISIBLE && (
        <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-muted-foreground hover:text-foreground px-1 font-mono tabular-nums text-left self-start rounded hover:bg-accent/50 transition-colors"
          >
            +{groups.length - MAX_VISIBLE} more
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={2}
            className="w-64 max-h-[320px] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] font-medium text-muted-foreground px-1 pb-1.5 uppercase tracking-wide">
              {format(day, 'EEE, MMM d')}
            </div>
            <div className="flex flex-col gap-1">
              {groups.slice(MAX_VISIBLE).map((grp) => (
                <EntryCard
                  key={grp.id}
                  group={grp}
                  onClick={() => { setMoreOpen(false); onGroupClick(grp) }}
                  selectMode={selectMode}
                  isSelected={selectedGroupIds?.has(grp.id)}
                  onToggleSelect={onToggleSelect}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
