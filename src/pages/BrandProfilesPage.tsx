import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, Globe, ExternalLink } from 'lucide-react'
import { useBrands } from '@/hooks/useBrands'
import type { BrandUpsert } from '@/hooks/useBrands'
import { useActiveBrand } from '@/stores/activeBrand'
import { BrandForm } from '@/components/brand/BrandForm'
import type { BrandProfile } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(values: BrandUpsert) {
    if (!editing) return
    setSubmitting(true)
    try {
      await updateBrand.mutateAsync({ id: editing.id, values })
      setEditing(null)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Brand Profiles</h1>
          <p className="mt-1 text-muted-foreground">
            Manage the brands and clients you create content for.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <Card key={brand.id} className="group relative overflow-hidden">
              {/* Color bar */}
              <div
                className="h-1.5 w-full"
                style={{ background: brand.color ?? '#6366f1' }}
              />
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm"
                    style={{ background: brand.color ?? '#6366f1' }}
                  >
                    {brand.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{brand.name}</h3>
                    <p className="truncate text-sm text-muted-foreground">{brand.niche}</p>
                    {brand.website_url && (
                      <a
                        href={brand.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Globe className="h-3 w-3" />
                        <span className="truncate">{brand.website_url.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Platforms */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {brand.platforms.map((p) => (
                    <Badge key={p} variant="secondary" className="capitalize text-xs">
                      {p}
                    </Badge>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setActiveBrand(brand)}
                  >
                    Set active
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setEditing(brand)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleting(brand)}
                  >
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
        <DialogContent className="max-w-lg">
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
        <DialogContent className="max-w-lg">
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
