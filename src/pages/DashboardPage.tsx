import { Briefcase, Users, Sparkles, CalendarDays, TrendingUp, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useActiveBrand } from '@/stores/activeBrand'
import { useBrands } from '@/hooks/useBrands'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const QUICK_ACTIONS = [
  {
    to: '/competitors',
    icon: Users,
    title: 'Research Competitors',
    description: 'Paste a handle and surface top posts',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    to: '/research',
    icon: TrendingUp,
    title: 'Niche Research',
    description: 'Discover trending topics in your niche',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    to: '/generator',
    icon: Sparkles,
    title: 'Generate Content',
    description: 'AI hooks, captions, and ideas',
    color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  },
  {
    to: '/calendar',
    icon: CalendarDays,
    title: 'Content Calendar',
    description: 'Schedule and manage your content',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
]

export function DashboardPage() {
  const { activeBrand } = useActiveBrand()
  const { brands, isLoading } = useBrands()

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  // No brands yet — onboarding state
  if (brands.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Briefcase className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Welcome to Zek Studio</h2>
          <p className="mt-2 text-muted-foreground">
            Create your first brand profile to get started with AI-powered content intelligence.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/brands?new=1">
            Create your first brand
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {activeBrand ? activeBrand.name : 'Dashboard'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {activeBrand
            ? `${activeBrand.niche} · ${activeBrand.platforms.join(', ')}`
            : 'Select a brand from the sidebar to get started.'}
        </p>
        {activeBrand && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeBrand.platforms.map((p) => (
              <Badge key={p} variant="secondary" className="capitalize text-xs">
                {p}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map(({ to, icon: Icon, title, description, color }) => (
            <Link key={to} to={to}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* All Brands */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your Brands
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/brands">Manage <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brands.slice(0, 6).map((brand) => (
            <Card key={brand.id} className="flex items-center gap-3 p-4">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ background: brand.color ?? '#6366f1' }}
              >
                {brand.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{brand.name}</p>
                <p className="truncate text-xs text-muted-foreground">{brand.niche}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
