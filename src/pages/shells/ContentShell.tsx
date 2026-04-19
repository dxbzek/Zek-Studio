import { SectionShell } from '@/components/layout/SectionShell'

const TABS = [
  { to: '/content/generator',  label: 'AI Generator'     },
  { to: '/content/templates',  label: 'Reply Templates'  },
]

export function ContentShell() {
  return <SectionShell title="Content" tabs={TABS} />
}
