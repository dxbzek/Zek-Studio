import type { ComponentType, SVGProps } from 'react'

export interface FormButtonGroupOption<T extends string> {
  value: T
  label: string
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  // Tailwind classes applied when this option is the selected value. Usually
  // a chip/token class from statusTokens — e.g. TASK_STATUS_CHIP[col.id].
  activeClassName?: string
}

interface FormButtonGroupProps<T extends string> {
  label: string
  options: readonly FormButtonGroupOption<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  // Radio a11y: container is role="radiogroup", buttons are role="radio" with
  // aria-checked. Keyboard nav (arrows) is browser-native via role.
  name?: string
}

// Replaces three near-identical blocks in TaskDrawer for status / type /
// priority. Kept narrow so the shape stays obvious — multi-select groups and
// groups with custom pill renderers shouldn't be forced through this API.
export function FormButtonGroup<T extends string>({
  label, options, value, onChange, disabled, name,
}: FormButtonGroupProps<T>) {
  const groupId = name ?? `fbg-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="space-y-1.5">
      <div id={`${groupId}-label`} className="text-sm font-medium">{label}</div>
      <div role="radiogroup" aria-labelledby={`${groupId}-label`} className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt.value
          const Icon = opt.icon
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                active
                  ? `${opt.activeClassName ?? ''} border-transparent`
                  : 'border-border text-muted-foreground hover:text-foreground'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
