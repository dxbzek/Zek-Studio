import type { ComponentType, ReactNode, SVGProps } from 'react'

interface EmptyStateProps {
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  description?: string
  cta?: ReactNode
  className?: string
}

// Single visual treatment for "no rows yet / no results" states. Replaces
// the mix of plain `text-sm` paragraphs, AlertCircle blocks, and bordered
// panels that grew across pages. Use for *page-level* empty states; column
// or card-level dashed-placeholder messages stay where they are because the
// surrounding shape carries the meaning.
export function EmptyState({ icon: Icon, title, description, cta, className }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 text-center ${className ?? ''}`}
    >
      {Icon && (
        <div className="mb-3 h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">{description}</p>
      )}
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  )
}
