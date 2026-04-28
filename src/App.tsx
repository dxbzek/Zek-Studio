import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AppShell } from '@/components/layout/AppShell'
import { ResearchShell }  from '@/pages/shells/ResearchShell'
import { WorkspaceShell } from '@/pages/shells/WorkspaceShell'

const LoginPage              = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })))
const ResetPasswordPage      = lazy(() => import('@/pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))
const DashboardPage          = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const BrandProfilesPage      = lazy(() => import('@/pages/BrandProfilesPage').then(m => ({ default: m.BrandProfilesPage })))
const CompetitorResearchPage = lazy(() => import('@/pages/CompetitorResearchPage').then(m => ({ default: m.CompetitorResearchPage })))
const NicheResearchPage      = lazy(() => import('@/pages/NicheResearchPage').then(m => ({ default: m.NicheResearchPage })))
const ContentGeneratorPage   = lazy(() => import('@/pages/ContentGeneratorPage').then(m => ({ default: m.ContentGeneratorPage })))
const ContentCalendarPage    = lazy(() => import('@/pages/ContentCalendarPage').then(m => ({ default: m.ContentCalendarPage })))
const SeoPage                = lazy(() => import('@/pages/SeoPage').then(m => ({ default: m.SeoPage })))
const TeamPage               = lazy(() => import('@/pages/TeamPage'))
const TaskBoardPage          = lazy(() => import('@/pages/TaskBoardPage'))
const AnalyticsPage          = lazy(() => import('@/pages/AnalyticsPage'))
const CampaignsPage          = lazy(() => import('@/pages/CampaignsPage'))
const PublicReportPage       = lazy(() => import('@/pages/PublicReportPage'))
const PublicApprovalPage     = lazy(() => import('@/pages/PublicApprovalPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
})

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/reset" element={<ResetPasswordPage />} />
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
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
        <Toaster richColors position="top-center" />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
