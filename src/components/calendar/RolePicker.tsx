import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { emailHandle } from './entryGroups'

interface RolePickerProps {
  value: string
  onChange: (v: string) => void
  members: { id: string; email: string }[]
}

export function RolePicker({ value, onChange, members }: RolePickerProps) {
  return (
    <div className="space-y-1">
      <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Unassigned</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.email}>
              {emailHandle(m.email)}
              <span className="text-muted-foreground ml-1 text-xs">({m.email})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {members.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          No team members yet — invite someone in Team.
        </p>
      )}
    </div>
  )
}
