import { memo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'

interface QuickAddTaskProps {
  onAdd: (title: string) => void
  disabled?: boolean
}

function QuickAddTaskImpl({ onAdd, disabled }: QuickAddTaskProps) {
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-1.5 rounded border border-dashed border-border bg-background/40 px-1.5 py-1 focus-within:border-primary/60 focus-within:bg-background transition-colors">
      <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) {
            onAdd(title.trim())
            setTitle('')
            inputRef.current?.blur()
          } else if (e.key === 'Escape') {
            setTitle('')
            inputRef.current?.blur()
          }
        }}
        placeholder="Add task…"
        disabled={disabled}
        className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none py-0.5 disabled:opacity-50"
      />
    </div>
  )
}

export const QuickAddTask = memo(QuickAddTaskImpl)
