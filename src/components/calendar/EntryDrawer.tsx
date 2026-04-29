import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { inferByNameMatch, inferContentType } from '@/lib/inferContentType'
import { Copy, ExternalLink, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PlatformPill } from '@/lib/platformBrand'
import {
  APPROVAL_STATUS_LABEL, APPROVAL_STATUS_SOLID, CALENDAR_STATUS_CHIP,
  CONTENT_FORMAT_SOLID,
} from '@/lib/statusTokens'
import { useActiveBrand } from '@/stores/activeBrand'
import {
  CONTENT_FORMATS, CONTENT_THEMES, PLATFORMS,
} from '@/types'
import type {
  ApprovalStatus, CalendarStatus, ContentFormat, ContentPillar, ContentTheme, Platform,
} from '@/types'
import { GeneratedContentPreview } from './GeneratedContentPreview'
import { RolePicker } from './RolePicker'
import type { EntryGroup } from './entryGroups'
import { STATUSES } from './entryGroups'

export interface EntryFormValues {
  title: string
  script: string
  notes: string
  format: ContentFormat | null
  date: string
  platforms: Platform[]
  contentType: ContentTheme
  status: CalendarStatus
  campaignId: string | null
  pillarId: string | null
  approvalStatus: ApprovalStatus | null
  approvalNote: string
  talent: string
  character: string
}

interface EntryDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  group: EntryGroup | null
  defaultDate?: string
  members: { id: string; email: string }[]
  campaigns: { id: string; name: string }[]
  pillars: ContentPillar[]
  saving: boolean
  deleting: boolean
  onSave: (values: EntryFormValues) => Promise<void>
  onDelete: () => void
  onDuplicate: () => Promise<void>
  duplicating?: boolean
  // Optional: when provided, a Generate button appears next to the Script
  // label. Parent is responsible for calling the AI generator and returning
  // the text to paste into the script field.
  onGenerateCaption?: (args: { title: string; platform: Platform; theme: ContentTheme }) => Promise<string | null>
}

// Auto-detect URLs in plain-text fields so a pasted reference link is
// actually clickable. Excludes parens/brackets so markdown-style
// `[label](url)` and parenthetical `(see https://x.com)` work cleanly.
const URL_RE = /https?:\/\/[^\s<>"'()\[\]]+/gi

function extractLinks(text: string): string[] {
  const matches = text.match(URL_RE) ?? []
  const cleaned = matches
    .map((u) => u.replace(/[.,;:!?]+$/, ''))
    .filter(Boolean)
  return Array.from(new Set(cleaned))
}

// Short-form scripts run 30–40 seconds at speaking pace. We use 2.7 words/sec
// (~165 wpm) which is the conservative end of natural delivery — voiceover
// pros go faster, on-camera talent typically slower.
const TARGET_MIN_SEC = 30
const TARGET_MAX_SEC = 40
const WORDS_PER_SEC = 2.7

function ScriptCounter({ text }: { text: string }) {
  const lines = text.split('\n').filter((l) => l.trim().length > 0).length
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  if (words === 0) return null
  const seconds = Math.round(words / WORDS_PER_SEC)
  const inTarget = seconds >= TARGET_MIN_SEC && seconds <= TARGET_MAX_SEC
  const chipClass = inTarget
    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
      <span className="tabular-nums">Lines: {lines}</span>
      <span className="tabular-nums">Words: {words}</span>
      <span className={`tabular-nums px-1.5 py-0.5 rounded font-medium ${chipClass}`}>
        ~{seconds}s · target {TARGET_MIN_SEC}–{TARGET_MAX_SEC}s
      </span>
    </div>
  )
}

function LinksRow({ text }: { text: string }) {
  const urls = extractLinks(text)
  if (urls.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
      <span className="text-muted-foreground">Links:</span>
      {urls.map((u) => (
        <a
          key={u}
          href={u}
          target="_blank"
          rel="noopener noreferrer"
          title={u}
          className="inline-flex items-center gap-1 max-w-[280px] text-primary hover:underline"
        >
          <span className="truncate">{u.replace(/^https?:\/\/(www\.)?/, '')}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ))}
    </div>
  )
}

const INITIAL: EntryFormValues = {
  title: '',
  script: '',
  notes: '',
  format: null,
  date: format(new Date(), 'yyyy-MM-dd'),
  platforms: ['instagram'],
  contentType: 'property_tour',
  status: 'draft',
  campaignId: null,
  pillarId: null,
  approvalStatus: null,
  approvalNote: '',
  talent: '',
  character: '',
}

const ALL_PLATFORMS = PLATFORMS.map((p) => p.value)

export function EntryDrawer({
  open, onOpenChange, mode, group, defaultDate, members, campaigns, pillars,
  saving, deleting, onSave, onDelete, onDuplicate, duplicating, onGenerateCaption,
}: EntryDrawerProps) {
  const { activeBrand } = useActiveBrand()
  const [values, setValues] = useState<EntryFormValues>(INITIAL)
  const [generating, setGenerating] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  // Snapshot of the values when the drawer opened, so we can detect dirty
  // edits and guard the close action.
  const initialValuesRef = useRef<EntryFormValues>(INITIAL)
  const titleInputRef = useRef<HTMLInputElement>(null)
  // True once the user has explicitly clicked the corresponding chip. While
  // false, the title-watch effect auto-fills that field from the title so
  // the user doesn't have to duplicate the work. In edit mode all three
  // start true — respect whatever was saved, don't overwrite on first
  // keystroke.
  const typeManuallyPicked = useRef(false)
  const campaignManuallyPicked = useRef(false)
  const pillarManuallyPicked = useRef(false)

  useEffect(() => {
    if (!open) return
    let next: EntryFormValues
    if (mode === 'edit' && group) {
      const rep = group.representative
      typeManuallyPicked.current = true
      campaignManuallyPicked.current = true
      pillarManuallyPicked.current = true
      next = {
        title: rep.title,
        script: rep.script ?? '',
        notes: rep.notes ?? '',
        format: rep.format ?? null,
        date: rep.scheduled_date,
        platforms: group.platforms,
        contentType: (rep.content_type as ContentTheme) ?? 'property_tour',
        status: rep.status,
        campaignId: rep.campaign_id ?? null,
        pillarId: rep.pillar_id ?? null,
        approvalStatus: rep.approval_status ?? null,
        approvalNote: rep.approval_note ?? '',
        talent: rep.assigned_talent ?? '',
        character: rep.character ?? '',
      }
    } else {
      typeManuallyPicked.current = false
      campaignManuallyPicked.current = false
      pillarManuallyPicked.current = false
      // Pre-select the brand's connected platforms so the user doesn't tap
      // through them every time. Fall back to all platforms if the brand
      // hasn't configured any, so the form is never empty.
      const brandPlatforms = activeBrand?.platforms?.length
        ? (activeBrand.platforms as Platform[])
        : ALL_PLATFORMS
      next = {
        ...INITIAL,
        platforms: brandPlatforms,
        date: defaultDate ?? format(new Date(), 'yyyy-MM-dd'),
      }
    }
    setValues(next)
    initialValuesRef.current = next
  }, [open, mode, group, defaultDate, activeBrand])

  // Autofocus the title input when creating. Sheet animates in, so wait one
  // tick before grabbing focus or the radix focus-trap will pull it back.
  useEffect(() => {
    if (!open || mode !== 'create') return
    const t = setTimeout(() => titleInputRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [open, mode])

  // Auto-fill content type, campaign, and pillar from the title (create
  // mode only, and only until the user explicitly picks each chip). Silent
  // when nothing matches — don't flip back to default or clear a previous
  // inference when the title is edited to remove the keyword.
  useEffect(() => {
    if (!open) return
    const patch: Partial<EntryFormValues> = {}
    if (!typeManuallyPicked.current) {
      const t = inferContentType(values.title)
      if (t && t !== values.contentType) patch.contentType = t
    }
    if (!campaignManuallyPicked.current && campaigns.length > 0) {
      const id = inferByNameMatch(values.title, campaigns)
      if (id && id !== values.campaignId) patch.campaignId = id
    }
    if (!pillarManuallyPicked.current && pillars.length > 0) {
      const id = inferByNameMatch(
        values.title,
        pillars.map((p) => ({ id: p.id, name: p.label })),
      )
      if (id && id !== values.pillarId) patch.pillarId = id
    }
    if (Object.keys(patch).length > 0) {
      setValues((prev) => ({ ...prev, ...patch }))
    }
  }, [values.title, open, campaigns, pillars]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof EntryFormValues>(k: K, v: EntryFormValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }))

  const today = format(new Date(), 'yyyy-MM-dd')
  const isPastDate = values.date < today
  const isValid = values.title.trim().length > 0 && values.date.length > 0
  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValuesRef.current)

  async function handleSave() {
    if (!isValid || saving) return
    // Past-dated entries are forced to 'published' so the calendar doesn't
    // show historical posts as still "Scheduled". DB trigger (migration 037)
    // enforces this server-side too.
    const final: EntryFormValues = isPastDate
      ? { ...values, status: 'published' }
      : values
    await onSave(final)
  }

  // Keep handleSave in a ref so the keydown listener doesn't have to re-bind
  // every render, and never reads a stale closure.
  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave

  // Cmd/Ctrl+Enter saves from anywhere in the drawer (including inside a
  // textarea — plain Enter still inserts a newline).
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSaveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Intercept close so we can confirm if there are unsaved edits. The Sheet
  // component itself routes Esc, X-button, and outside-click clicks all
  // through onOpenChange.
  function handleSheetOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true)
      return
    }
    if (isDirty && !saving) {
      setConfirmDiscard(true)
      return
    }
    onOpenChange(false)
  }

  function discardAndClose() {
    setConfirmDiscard(false)
    onOpenChange(false)
  }

  async function handleGenerateCaption() {
    if (!onGenerateCaption) return
    if (!values.title.trim()) {
      toast.error('Add a title first', { description: 'The generator uses the title as the brief.' })
      return
    }
    if (values.platforms.length === 0) {
      toast.error('Pick at least one platform')
      return
    }
    setGenerating(true)
    try {
      const result = await onGenerateCaption({
        title: values.title,
        // First selected platform: generator operates on a single platform;
        // the user can re-run per sibling entry if they need per-platform
        // variants.
        platform: values.platforms[0],
        theme: values.contentType,
      })
      if (result) {
        setValues((prev) => ({ ...prev, script: result }))
        toast.success('Script drafted')
      }
    } catch (err) {
      toast.error('Couldn\'t draft script', { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 w-[96vw] sm:max-w-7xl">
        <SheetHeader className="border-b border-border px-6 py-4 space-y-1">
          <div className="eyebrow">
            {mode === 'create'
              ? 'New entry'
              : values.date
              ? format(parseISO(values.date), 'EEE · MMM d, yyyy')
              : 'Edit entry'}
          </div>
          <SheetTitle className="font-heading font-medium tracking-tight text-[22px] leading-tight truncate">
            {mode === 'create'
              ? 'Draft a post'
              : values.title.trim() || 'Untitled entry'}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {mode === 'create'
              ? 'Create a new calendar entry for this brand.'
              : 'Edit this calendar entry.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title</label>
            <Input
              ref={titleInputRef}
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Entry title…"
            />
          </div>

          {/* Script + Notes — paired side-by-side on wide drawers so the
              brief and the production notes read together. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Script / Concept */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Script / Concept{' '}
                  <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </label>
                {onGenerateCaption && (
                  <button
                    type="button"
                    onClick={handleGenerateCaption}
                    disabled={generating || !values.title.trim() || values.platforms.length === 0}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Use the AI generator with the title as the brief"
                  >
                    {generating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {generating ? 'Drafting…' : 'Generate'}
                  </button>
                )}
              </div>
              <Textarea
                value={values.script}
                onChange={(e) => set('script', e.target.value)}
                rows={10}
                className="resize-y min-h-[220px] font-mono text-[13px] leading-6"
                placeholder={'One line per beat — hook, point, point, CTA.\nAim for 30–40s of speaking time.'}
              />
              <ScriptCounter text={values.script} />
              <LinksRow text={values.script} />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Notes{' '}
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </label>
              <Textarea
                value={values.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={10}
                className="resize-y min-h-[220px]"
                placeholder="Links, location notes, props, anything internal."
              />
              <LinksRow text={values.notes} />
            </div>
          </div>

          {/* Date + Status (paired on wider screens) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Scheduled date</label>
              <input
                type="date"
                value={values.date}
                onChange={(e) => set('date', e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Status</label>
              <div className="flex gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => set('status', s.value)}
                    disabled={isPastDate && s.value !== 'published'}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      (isPastDate ? 'published' : values.status) === s.value
                        ? `${CALENDAR_STATUS_CHIP[s.value]} border-transparent`
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {isPastDate && (
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Date is in the past. Will save as Published.
                </p>
              )}
            </div>
          </div>

          {/* Platform */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Platform
              {mode === 'create' && (
                <span className="text-muted-foreground font-normal text-xs ml-1">(select one or more)</span>
              )}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    set('platforms', values.platforms.includes(p.value)
                      ? values.platforms.length > 1
                        ? values.platforms.filter((x) => x !== p.value)
                        : values.platforms
                      : [...values.platforms, p.value])
                  }}
                  className="rounded-full hover:opacity-90 transition-opacity"
                >
                  <PlatformPill platform={p.value} label={p.label} active={values.platforms.includes(p.value)} />
                </button>
              ))}
            </div>
          </div>

          {/* Content type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Content type</label>
            <div className="flex flex-wrap gap-1.5">
              {CONTENT_THEMES.map((ct) => (
                <button
                  key={ct.value}
                  type="button"
                  title={ct.desc}
                  aria-label={`${ct.label}: ${ct.desc}`}
                  aria-pressed={values.contentType === ct.value}
                  onClick={() => {
                    typeManuallyPicked.current = true
                    set('contentType', ct.value as ContentTheme)
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    values.contentType === ct.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Format{' '}
              <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => set('format', null)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  values.format === null
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                None
              </button>
              {CONTENT_FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  title={f.desc}
                  aria-label={`${f.label}: ${f.desc}`}
                  aria-pressed={values.format === f.value}
                  onClick={() => set('format', f.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    values.format === f.value
                      ? CONTENT_FORMAT_SOLID[f.value]
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Client Approval */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Client Approval{' '}
              <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {([null, 'pending_review', 'approved', 'rejected'] as const).map((s) => {
                const selected = values.approvalStatus === s
                const selectedClass = s
                  ? APPROVAL_STATUS_SOLID[s]
                  : 'bg-muted text-foreground border-border'
                return (
                  <button
                    key={s ?? '__none__'}
                    type="button"
                    onClick={() => set('approvalStatus', s)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      selected ? selectedClass : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s === null ? 'None' : APPROVAL_STATUS_LABEL[s]}
                  </button>
                )
              })}
            </div>
            {values.approvalStatus && (
              <Textarea
                value={values.approvalNote}
                onChange={(e) => set('approvalNote', e.target.value)}
                placeholder={
                  values.approvalStatus === 'rejected'
                    ? 'Reason for rejection…'
                    : values.approvalStatus === 'approved'
                    ? 'Approval note (optional)…'
                    : 'Note for reviewer (optional)…'
                }
                rows={2}
                className="resize-y text-sm min-h-[60px]"
              />
            )}
          </div>

          {/* Campaign + Specialist (paired on wider screens) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {campaigns.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Campaign{' '}
                  <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </label>
                <Select
                  value={values.campaignId ?? '__none__'}
                  onValueChange={(v) => {
                    campaignManuallyPicked.current = true
                    set('campaignId', v === '__none__' ? null : v)
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Assigned Specialist{' '}
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </label>
              <RolePicker
                value={values.talent}
                onChange={(v) => set('talent', v)}
                members={members}
              />
            </div>
          </div>

          {/* Pillar */}
          {pillars.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Pillar{' '}
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    pillarManuallyPicked.current = true
                    set('pillarId', null)
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    !values.pillarId
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  None
                </button>
                {pillars.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      pillarManuallyPicked.current = true
                      set('pillarId', p.id)
                    }}
                    style={
                      values.pillarId === p.id
                        ? { backgroundColor: p.color, color: 'white', borderColor: p.color }
                        : {}
                    }
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      values.pillarId !== p.id ? 'border-border text-muted-foreground hover:text-foreground' : ''
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'edit' && group?.representative.generated_content_id && (
            <GeneratedContentPreview id={group.representative.generated_content_id} />
          )}
        </div>

        <SheetFooter className="border-t border-border px-6 py-4 flex-row gap-2 flex-wrap">
          {mode === 'edit' && (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={deleting}
              >
                Delete
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDuplicate}
                disabled={duplicating}
                title="Duplicate this entry as a draft"
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Duplicate
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSheetOpenChange(false)}
            className="ml-auto"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !isValid}
            title={!isValid ? 'Title and date are required' : undefined}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits on this entry. Closing now will lose them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={discardAndClose}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
