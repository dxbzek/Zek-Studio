import { CalendarDays, Construction } from 'lucide-react'
import { useActiveBrand } from '@/stores/activeBrand'
import { NoBrandSelected } from '@/components/layout/NoBrandSelected'

export function ContentCalendarPage() {
  const { activeBrand } = useActiveBrand()

  if (!activeBrand) return <NoBrandSelected />

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Content Calendar</h1>
        <p className="mt-1 text-muted-foreground">
          Scheduling content for <span className="font-medium text-foreground">{activeBrand.name}</span>
        </p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
          <CalendarDays className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="font-medium">Coming in Phase 5</p>
          <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5 justify-center">
            <Construction className="h-3.5 w-3.5" />
            Weekly and monthly calendar with drag & drop scheduling
          </p>
        </div>
      </div>
    </div>
  )
}
