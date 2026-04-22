import { useDroppable } from '@dnd-kit/core'
import { format, isSameDay } from 'date-fns'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { EntryCard } from './EntryCard'
import type { EntryGroup } from './entryGroups'

const MAX_VISIBLE = 3

interface DayCellProps {
  day: Date
  groups: EntryGroup[]
  isCurrentMonth: boolean
  tall?: boolean
  onGroupClick: (group: EntryGroup) => void
  onAddClick: () => void
}

export function DayCell({
  day, groups, isCurrentMonth, tall, onGroupClick, onAddClick,
}: DayCellProps) {
  const dateStr = format(day, 'yyyy-MM-dd')
  const { isOver, setNodeRef } = useDroppable({ id: dateStr })
  const todayFlag = isSameDay(day, new Date())

  return (
    <div
      ref={setNodeRef}
      onClick={() => { if (isCurrentMonth) onAddClick() }}
      className={`group border-b border-r border-border p-1 sm:p-1.5 flex flex-col gap-1 transition-colors ${tall ? 'min-h-[180px] sm:min-h-[200px]' : 'min-h-[80px] sm:min-h-[110px]'} ${!isCurrentMonth ? 'bg-muted/20' : 'cursor-pointer hover:bg-accent/30'} ${isOver ? 'bg-primary/5' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`font-mono text-[11px] sm:text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full tabular-nums ${todayFlag ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          {format(day, 'd')}
        </span>
        {isCurrentMonth && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddClick() }}
            className="sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-foreground text-sm leading-none h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-opacity"
            aria-label="Add entry"
          >
            +
          </button>
        )}
      </div>
      {groups.slice(0, MAX_VISIBLE).map((grp) => (
        <EntryCard key={grp.id} group={grp} onClick={() => onGroupClick(grp)} />
      ))}
      {groups.length > MAX_VISIBLE && (
        <Popover>
          <PopoverTrigger
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-muted-foreground hover:text-foreground px-1 font-mono tabular-nums text-left self-start rounded hover:bg-accent/50 transition-colors"
          >
            +{groups.length - MAX_VISIBLE} more
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-64 max-h-[320px] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] font-medium text-muted-foreground px-1 pb-1.5 uppercase tracking-wide">
              {format(day, 'EEE, MMM d')}
            </div>
            <div className="flex flex-col gap-1">
              {groups.slice(MAX_VISIBLE).map((grp) => (
                <EntryCard key={grp.id} group={grp} onClick={() => onGroupClick(grp)} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
