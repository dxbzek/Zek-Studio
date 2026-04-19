import { SectionShell } from '@/components/layout/SectionShell'

const TABS = [
  { to: '/workspace/tasks', label: 'Task Board' },
  { to: '/workspace/team',  label: 'Team'       },
]

export function WorkspaceShell() {
  return <SectionShell title="Workspace" tabs={TABS} scrollable={false} />
}
