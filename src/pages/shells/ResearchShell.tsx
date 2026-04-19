import { SectionShell } from '@/components/layout/SectionShell'

const TABS = [
  { to: '/research/niche',       label: 'Niche Research' },
  { to: '/research/competitors', label: 'Competitors'    },
  { to: '/research/seo',         label: 'SEO'            },
]

export function ResearchShell() {
  return <SectionShell title="Research" tabs={TABS} />
}
