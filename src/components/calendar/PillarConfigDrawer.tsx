import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ContentPillar } from '@/types'
import { PILLAR_COLORS } from './entryGroups'

interface PillarConfigDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pillars: ContentPillar[]
  creating: boolean
  onAdd: (input: { label: string; target_pct: number; color: string }) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}

export function PillarConfigDrawer({
  open, onOpenChange, pillars, creating, onAdd, onDelete,
}: PillarConfigDrawerProps) {
  const [label, setLabel] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [pct, setPct] = useState(20)
  // Confirmation dialog for delete — destructive action gets the same
  // popup pattern used elsewhere in the app instead of an instant remove.
  const [pendingDelete, setPendingDelete] = useState<ContentPillar | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleAdd() {
    if (!label.trim()) return
    try {
      await onAdd({ label: label.trim(), target_pct: pct, color })
      setLabel(''); setPct(20); setColor('#6366f1')
      toast.success('Pillar added')
    } catch (err) {
      toast.error('Failed to add pillar', { description: (err as Error).message })
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await onDelete(pendingDelete.id)
      toast.success('Pillar deleted')
      setPendingDelete(null)
    } catch (err) {
      toast.error('Failed to delete pillar', { description: (err as Error).message })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle>Configure Pillars</SheetTitle>
          <SheetDescription className="sr-only">
            Manage content pillars for this brand and their target percentages.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {pillars.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pillars yet. Add one below.</p>
          ) : (
            <div className="space-y-2">
              {pillars.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ background: p.color }}
                  />
                  <span className="text-sm font-medium flex-1">{p.label}</span>
                  <span className="text-xs text-muted-foreground">{p.target_pct}% target</span>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(p)}
                    aria-label={`Delete ${p.label}`}
                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-medium">Add Pillar</p>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Label</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Educational, Promotional"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Target % of posts</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
                className="h-8 text-sm w-24"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Color</label>
              <div className="flex flex-wrap gap-2">
                {PILLAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{ background: c }}
                    className={`h-6 w-6 rounded-full transition-all duration-150 ${
                      color === c
                        ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110'
                        : 'hover:scale-110 opacity-80 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!label.trim() || creating}
            >
              {creating ? 'Adding…' : 'Add Pillar'}
            </Button>
          </div>
        </div>
        <SheetFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="ml-auto">
            Done
          </Button>
        </SheetFooter>
      </SheetContent>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => { if (!o) setPendingDelete(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete pillar {pendingDelete ? `"${pendingDelete.label}"` : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Existing entries assigned to this pillar will keep the assignment but the pillar will no longer appear in the picker.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
