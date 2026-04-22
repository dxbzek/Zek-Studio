import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { NoBrandSelected } from '@/components/layout/NoBrandSelected'
import { useActiveBrand } from '@/stores/activeBrand'
import { useCampaigns } from '@/hooks/useCampaigns'
import { supabase } from '@/lib/supabase'
import type { Campaign } from '@/types'

const CAMPAIGN_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#64748b', '#0f172a',
]

// Fetches one row per calendar entry that belongs to any campaign in this
// brand, then buckets them by campaign_id in memory. One query instead of
// N — keeps the grid from firing a request per card.
function useCampaignEntryCounts(brandId: string | null) {
  return useQuery({
    queryKey: ['campaign-entry-counts', brandId],
    queryFn: async () => {
      if (!brandId) return {} as Record<string, number>
      const { data, error } = await supabase
        .from('calendar_entries')
        .select('campaign_id')
        .eq('brand_id', brandId)
        .not('campaign_id', 'is', null)
      if (error) throw error
      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        const cid = row.campaign_id as string | null
        if (cid) counts[cid] = (counts[cid] ?? 0) + 1
      }
      return counts
    },
    enabled: !!brandId,
  })
}

export default function CampaignsPage() {
  const { activeBrand } = useActiveBrand()
  const { campaigns, createCampaign, updateCampaign, deleteCampaign } = useCampaigns(
    activeBrand?.id ?? null
  )
  const entryCounts = useCampaignEntryCounts(activeBrand?.id ?? null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [goal, setGoal] = useState('')

  function openCreate() {
    setEditingId(null)
    setName('')
    setDescription('')
    setColor('#6366f1')
    setStartDate('')
    setEndDate('')
    setGoal('')
    setDrawerOpen(true)
  }

  function openEdit(campaign: Campaign) {
    setEditingId(campaign.id)
    setName(campaign.name)
    setDescription(campaign.description ?? '')
    setColor(campaign.color)
    setStartDate(campaign.start_date ?? '')
    setEndDate(campaign.end_date ?? '')
    setGoal(campaign.goal ?? '')
    setDrawerOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('Campaign name is required'); return }
    if (startDate && endDate && endDate < startDate) {
      toast.error('End date must be on or after the start date')
      return
    }
    if (!activeBrand) return
    try {
      if (editingId) {
        await updateCampaign.mutateAsync({
          id: editingId,
          patch: {
            name: name.trim(),
            description: description.trim() || null,
            color,
            start_date: startDate || null,
            end_date: endDate || null,
            goal: goal.trim() || null,
          },
        })
        toast.success('Campaign updated')
      } else {
        await createCampaign.mutateAsync({
          brand_id: activeBrand.id,
          name: name.trim(),
          description: description.trim() || null,
          color,
          start_date: startDate || null,
          end_date: endDate || null,
          goal: goal.trim() || null,
        })
        toast.success('Campaign created')
      }
      setDrawerOpen(false)
    } catch (err) {
      toast.error('Failed to save', { description: (err as Error).message })
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCampaign.mutateAsync(id)
      toast.success('Campaign deleted')
    } catch (err) {
      toast.error('Failed to delete', { description: (err as Error).message })
    }
  }

  if (!activeBrand) return <NoBrandSelected />

  const list = campaigns.data ?? []
  const saving = createCampaign.isPending || updateCampaign.isPending

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="eyebrow mb-1.5">Collaborate</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.025em' }}>Campaigns</h1>
          <p className="text-[13px] text-muted-foreground mt-1">{activeBrand.name}</p>
        </div>
        <Button size="sm" onClick={openCreate}>New Campaign</Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {campaigns.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading campaigns…</span>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground text-sm">No campaigns yet.</p>
            <p className="text-muted-foreground text-xs mt-1">Create your first campaign to group calendar entries together.</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={openCreate}>
              New Campaign
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {list.map((campaign) => (
              <div
                key={campaign.id}
                className="rounded-lg border border-border bg-card overflow-hidden"
                style={{ borderLeftColor: campaign.color, borderLeftWidth: 4 }}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm truncate">{campaign.name}</h3>
                      {campaign.goal && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Goal: {campaign.goal}
                        </p>
                      )}
                      {(campaign.start_date || campaign.end_date) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {campaign.start_date
                            ? format(parseISO(campaign.start_date), 'MMM d')
                            : '…'}{' '}
                          –{' '}
                          {campaign.end_date
                            ? format(parseISO(campaign.end_date), 'MMM d, yyyy')
                            : '…'}
                        </p>
                      )}
                      {campaign.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {campaign.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(campaign)}
                        aria-label={`Edit ${campaign.name}`}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(campaign.id)}
                        aria-label={`Delete ${campaign.name}`}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      {entryCounts.isLoading ? '…' : entryCounts.data?.[campaign.id] ?? 0} entries
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle>{editingId ? 'Edit Campaign' : 'New Campaign'}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramadan 2025"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Goal{' '}
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </label>
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Reach 10K new followers"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Start date{' '}
                  <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  End date{' '}
                  <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Description{' '}
                  <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </label>
                <span className="text-[10.5px] tabular-nums text-muted-foreground">
                  {description.length}/500
                </span>
              </div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                rows={3}
                maxLength={500}
                className="resize-none"
                placeholder="Campaign notes or strategy…"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex flex-wrap gap-2">
                {CAMPAIGN_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{ background: c }}
                    className={`h-7 w-7 rounded-full transition-all duration-150 ${
                      color === c
                        ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110'
                        : 'hover:scale-110 opacity-80 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
          <SheetFooter className="border-t border-border px-6 py-4 flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setDrawerOpen(false)} className="ml-auto">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create campaign'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
