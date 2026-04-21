import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { BrandProfile } from '@/types'

// Thin wrapper around the shadcn Select for picking a brand. Used in the
// Team page dialogs so the invite/reassign flows stay visually identical
// without duplicating three nearly-identical markup blocks.
export function BrandSelect({
  brands,
  value,
  onChange,
  placeholder = 'Select brand',
  className = 'h-9 text-sm',
}: {
  brands: BrandProfile[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {brands.map((b) => (
          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
