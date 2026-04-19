import { useState, useMemo } from 'react'
import { Check, Copy, Trash2 } from 'lucide-react'
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
import { useReplyTemplates } from '@/hooks/useReplyTemplates'
import { PLATFORMS } from '@/types'
import type { Platform, ReplyTemplate } from '@/types'

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  tiktok:    'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  facebook:  'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  linkedin:  'bg-blue-800/10 text-blue-800 dark:text-blue-300',
  youtube:   'bg-red-500/10 text-red-600 dark:text-red-400',
}

export default function ReplyTemplatesPage() {
  const { activeBrand } = useActiveBrand()
  const { templates, createTemplate, deleteTemplate } = useReplyTemplates(
    activeBrand?.id ?? null
  )

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterPlatform, setFilterPlatform] = useState<string>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form state
  const [formLabel, setFormLabel] = useState('')
  const [formText, setFormText] = useState('')
  const [formPlatform, setFormPlatform] = useState<Platform | null>(null)
  const [formTags, setFormTags] = useState('')

  function openCreate() {
    setFormLabel('')
    setFormText('')
    setFormPlatform(null)
    setFormTags('')
    setDrawerOpen(true)
  }

  async function handleSave() {
    if (!formLabel.trim() || !formText.trim()) {
      toast.error('Label and text are required')
      return
    }
    if (!activeBrand) return
    const tags = formTags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      await createTemplate.mutateAsync({
        brand_id: activeBrand.id,
        label: formLabel.trim(),
        text: formText.trim(),
        platform: formPlatform,
        tags,
      })
      toast.success('Template saved')
      setDrawerOpen(false)
    } catch (err) {
      toast.error('Failed to save', { description: (err as Error).message })
    }
  }

  async function handleCopy(t: ReplyTemplate) {
    await navigator.clipboard.writeText(t.text)
    setCopiedId(t.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  async function handleDelete(id: string) {
    try {
      await deleteTemplate.mutateAsync(id)
      toast.success('Template deleted')
    } catch (err) {
      toast.error('Failed to delete', { description: (err as Error).message })
    }
  }

  const filtered = useMemo(() => {
    let list = templates.data ?? []
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) => t.label.toLowerCase().includes(q) || t.text.toLowerCase().includes(q)
      )
    }
    if (filterPlatform !== 'all') {
      list = list.filter((t) => t.platform === filterPlatform || !t.platform)
    }
    return list
  }, [templates.data, search, filterPlatform])

  if (!activeBrand) return <NoBrandSelected />

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="eyebrow mb-1.5">Create</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.025em' }}>Reply Templates</h1>
          <p className="text-[13px] text-muted-foreground mt-1">{activeBrand.name}</p>
        </div>
        <Button size="sm" onClick={openCreate}>New Template</Button>
      </div>

      {/* Filters */}
      <div className="px-6 pb-3 flex items-center gap-2 flex-wrap border-b border-border shrink-0">
        <Input
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-full max-w-[200px] text-sm"
        />
        <div className="flex items-center gap-1.5 ml-2">
          <button
            type="button"
            onClick={() => setFilterPlatform('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterPlatform === 'all'
                ? 'bg-foreground text-background border-transparent'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            All platforms
          </button>
          {PLATFORMS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setFilterPlatform(p.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterPlatform === p.value
                  ? `${PLATFORM_COLORS[p.value]} border-transparent`
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {templates.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground text-sm">
              {(templates.data ?? []).length === 0
                ? 'No templates yet.'
                : 'No templates match your search.'}
            </p>
            {(templates.data ?? []).length === 0 && (
              <>
                <p className="text-muted-foreground text-xs mt-1">
                  Save canned replies for common DMs and comments.
                </p>
                <Button size="sm" variant="outline" className="mt-4" onClick={openCreate}>
                  New Template
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => {
              const isExpanded = expandedId === t.id
              return (
                <div
                  key={t.id}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{t.label}</span>
                        {t.platform && (
                          <span
                            className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                              PLATFORM_COLORS[t.platform] ?? 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {t.platform}
                          </span>
                        )}
                        {t.tags.length > 0 &&
                          t.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                      </div>
                      <p
                        className={`text-sm text-muted-foreground mt-1.5 ${
                          !isExpanded ? 'line-clamp-3' : ''
                        }`}
                      >
                        {t.text}
                      </p>
                      {t.text.length > 150 && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : t.id)}
                          className="text-xs text-primary mt-1 hover:underline"
                        >
                          {isExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(t)}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy"
                      >
                        {copiedId === t.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle>New Reply Template</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Label</label>
              <Input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="e.g. DM — Collab inquiry, Comment — Thank you"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Template text</label>
              <Textarea
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                rows={5}
                className="resize-none"
                placeholder="Hi! Thanks for reaching out. We'd love to discuss a collaboration…"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Platform{' '}
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFormPlatform(null)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    !formPlatform
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  All platforms
                </button>
                {PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setFormPlatform(p.value)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      formPlatform === p.value
                        ? `${PLATFORM_COLORS[p.value]} border-transparent`
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Tags{' '}
                <span className="text-muted-foreground font-normal text-xs">
                  (optional, comma-separated)
                </span>
              </label>
              <Input
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="collab, dm, thank-you"
              />
            </div>
          </div>
          <SheetFooter className="border-t border-border px-6 py-4 flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDrawerOpen(false)}
              className="ml-auto"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={createTemplate.isPending}>
              {createTemplate.isPending ? 'Saving…' : 'Save template'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
