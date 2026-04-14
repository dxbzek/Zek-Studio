import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { BrandProfilesPage } from '@/pages/BrandProfilesPage'
import { CompetitorResearchPage } from '@/pages/CompetitorResearchPage'
import { NicheResearchPage } from '@/pages/NicheResearchPage'
import { ContentGeneratorPage } from '@/pages/ContentGeneratorPage'
import { ContentCalendarPage } from '@/pages/ContentCalendarPage'

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
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/brands" element={<BrandProfilesPage />} />
              <Route path="/competitors" element={<CompetitorResearchPage />} />
              <Route path="/research" element={<NicheResearchPage />} />
              <Route path="/generator" element={<ContentGeneratorPage />} />
              <Route path="/calendar" element={<ContentCalendarPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="bottom-right" />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
