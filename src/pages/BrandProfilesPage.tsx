import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Globe, ExternalLink } from 'lucide-react'
import { useBrands } from '@/hooks/useBrands'
import type { BrandUpsert } from '@/hooks/useBrands'
import { useActiveBrand } from '@/stores/activeBrand'
import { BrandForm } from '@/components/brand/BrandForm'
import type { BrandProfile } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function BrandProfilesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { brands, isLoading, createBrand, updateBrand, deleteBrand } = useBrands()
  const { setActiveBrand } = useActiveBrand()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<BrandProfile | null>(null)
  const [deleting, setDeleting] = useState<BrandProfile | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Auto-open create dialog if ?new=1 in URL
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowForm(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  async function handleCreate(values: BrandUpsert) {
    setSubmitting(true)
    try {
      const brand = await createBrand.mutateAsync(values)
      setActiveBrand(brand)
      setShowForm(false)
    } catch (err) {
      toast.error('Failed to create brand', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(values: BrandUpsert) {
    if (!editing) return
    setSubmitting(true)
    try {
      const updated = await updateBrand.mutateAsync({ id: editing.id, values })
      setActiveBrand(updated)
      setEditing(null)
    } catch (err) {
      toast.error('Failed to save changes', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    await deleteBrand.mutateAsync(deleting.id)
    setDeleting(null)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow mb-1.5">Workspace</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.025em' }}>
            Brand Profiles
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1.5">
            Manage the brands and clients you create content for.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add brand
        </Button>
      </div>

      {/* Brand Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="h-40 animate-pulse bg-muted" />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-muted-foreground">No brands yet.</p>
          <Button
            variant="link"
            className="mt-2"
            onClick={() => setShowForm(true)}
          >
            Create your first brand →
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <Card key={brand.id} className="group relative overflow-hidden rounded-xl border border-border bg-card hover:bg-muted/20 transition-colors">
              <div className="h-[3px] w-full" style={{ background: brand.color ?? '#B8C5D1' }} />
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[8px] text-[11px] font-bold text-white"
                    style={{ background: brand.color ?? '#B8C5D1' }}
                  >
                    {brand.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 500, letterSpacing: '-0.02em' }} className="truncate">
                      {brand.name}
                    </h3>
                    {brand.niche && (
                      <p className="truncate text-[12px] text-muted-foreground mt-0.5">{brand.niche}</p>
                    )}
                    {brand.website_url && (
                      <a
                        href={brand.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Globe className="h-3 w-3 shrink-0" />
                        <span className="truncate">{brand.website_url.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Platforms */}
                {brand.platforms.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {brand.platforms.map((p) => (
                      <span key={p} className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-background text-muted-foreground capitalize font-medium">
                        {p}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" className="flex-1 h-[30px] text-[12px]" onClick={() => setActiveBrand(brand)}>
                    Set active
                  </Button>
                  <Button size="icon" variant="ghost" className="h-[30px] w-[30px]" onClick={() => setEditing(brand)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-[30px] w-[30px] text-destructive hover:text-destructive" onClick={() => setDeleting(brand)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg overflow-y-auto max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>New Brand Profile</DialogTitle>
          </DialogHeader>
          <BrandForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg overflow-y-auto max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Edit Brand Profile</DialogTitle>
          </DialogHeader>
          {editing && (
            <BrandForm
              defaultValues={editing}
              onSubmit={handleUpdate}
              onCancel={() => setEditing(null)}
              submitting={submitting}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the brand profile and all associated
              competitors, posts, hooks, and calendar entries. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
