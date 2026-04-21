import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { BrandProfilesPage } from '@/pages/BrandProfilesPage'
import { CompetitorResearchPage } from '@/pages/CompetitorResearchPage'
import { NicheResearchPage } from '@/pages/NicheResearchPage'
import { ContentGeneratorPage } from '@/pages/ContentGeneratorPage'
import { ContentCalendarPage } from '@/pages/ContentCalendarPage'
import TeamPage from '@/pages/TeamPage'
import TaskBoardPage from '@/pages/TaskBoardPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import CampaignsPage from '@/pages/CampaignsPage'
import { SeoPage } from '@/pages/SeoPage'
import { ResearchShell }  from '@/pages/shells/ResearchShell'
import { WorkspaceShell } from '@/pages/shells/WorkspaceShell'
import PublicReportPage from '@/pages/PublicReportPage'
import PublicApprovalPage from '@/pages/PublicApprovalPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/report/:token" element={<PublicReportPage />} />
            <Route path="/approve/:token" element={<PublicApprovalPage />} />
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/brands" element={<BrandProfilesPage />} />
              {/* Research */}
              <Route path="/research" element={<ResearchShell />}>
                <Route index element={<Navigate to="niche" replace />} />
                <Route path="niche"       element={<NicheResearchPage />} />
                <Route path="competitors" element={<CompetitorResearchPage />} />
                <Route path="seo"         element={<SeoPage />} />
              </Route>

              {/* Content */}
              <Route path="/content" element={<ContentGeneratorPage />} />
              <Route path="/content/generator" element={<Navigate to="/content" replace />} />

              {/* Workspace */}
              <Route path="/workspace" element={<WorkspaceShell />}>
                <Route index element={<Navigate to="tasks" replace />} />
                <Route path="tasks" element={<TaskBoardPage />} />
                <Route path="team"  element={<TeamPage />} />
              </Route>

              <Route path="/calendar" element={<ContentCalendarPage />} />

              {/* Campaigns — accessed from Calendar header, not in sidebar */}
              <Route path="/campaigns" element={<CampaignsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
            </Route>
          </Routes>
          </ErrorBoundary>
        </BrowserRouter>
        <Toaster richColors position="bottom-right" />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
