import { Component, type ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Catches uncaught render errors so a broken page doesn't nuke the whole app
// to a blank screen. Surfaces a minimal panel with retry + reload affordances.
// React doesn't provide a hooks API for this — class component is required.

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep a dev-visible record; in prod we rely on whatever logging the
    // hosting env provides (Vercel surfaces console errors in the runtime log).
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
        </div>
        <div className="space-y-1 max-w-sm">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            {this.state.error.message || 'An unexpected error occurred rendering this page.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={this.reset}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
          </Button>
          <Button size="sm" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </div>
    )
  }
}
