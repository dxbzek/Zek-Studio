import { Link } from 'react-router-dom'
import { Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NoBrandSelected() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <Briefcase className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">No brand selected</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a brand from the sidebar, or create one first.
        </p>
      </div>
      <Button variant="outline" asChild>
        <Link to="/brands?new=1">Create a brand</Link>
      </Button>
    </div>
  )
}
