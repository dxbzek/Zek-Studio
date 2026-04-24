import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { inferContentType } from '@/lib/inferContentType'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PlatformPill } from '@/lib/platformBrand'
import {
  APPROVAL_STATUS_LABEL, APPROVAL_STATUS_SOLID, CALENDAR_STATUS_CHIP,
} from '@/lib/statusTokens'
import {
  CONTENT_THEMES, PLATFORMS,
} from '@/types'
import type {
  ApprovalStatus, CalendarStatus, ContentPillar, ContentTheme, Platform,
} from '@/types'
import { GeneratedContentPreview } from './GeneratedContentPreview'
import { RolePicker } from './RolePicker'
import type { EntryGroup } from './entryGroups'
import { STATUSES } from './entryGroups'

export interface EntryFormValues {
  title: string
  body: string
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
}

const INITIAL: EntryFormValues = {
  title: '',
  body: '',
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

export function EntryDrawer({
  open, onOpenChange, mode, group, defaultDate, members, campaigns, pillars,
  saving, deleting, onSave, onDelete, onDuplicate, duplicating,
}: EntryDrawerProps) {
  const [values, setValues] = useState<EntryFormValues>(INITIAL)
  // True once the user has explicitly clicked a content-type chip. While
  // false, the title-watch effect auto-fills contentType from the title so
  // the user doesn't have to duplicate the work. In edit mode we start this
  // true — respect whatever was saved, don't overwrite on first keystroke.
  const typeManuallyPicked = useRef(false)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && group) {
      const rep = group.representative
      typeManuallyPicked.current = true
      setValues({
        title: rep.title,
        body: rep.body ?? '',
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
      })
    } else {
      typeManuallyPicked.current = false
      setValues({
        ...INITIAL,
        date: defaultDate ?? format(new Date(), 'yyyy-MM-dd'),
      })
    }
  }, [open, mode, group, defaultDate])

  // Auto-fill content type as the user types the title (create mode only,
  // and only until they explicitly pick a chip). Silent when the helper
  // can't match — don't flip back to the default.
  useEffect(() => {
    if (!open) return
    if (typeManuallyPicked.current) return
    const inferred = inferContentType(values.title)
    if (inferred && inferred !== values.contentType) {
      setValues((prev) => ({ ...prev, contentType: inferred }))
    }
  }, [values.title, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof EntryFormValues>(k: K, v: EntryFormValues[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }))

  const today = format(new Date(), 'yyyy-MM-dd')
  const isPastDate = values.date < today

  async function handleSave() {
    // Past-dated entries are forced to 'published' so the calendar doesn't
    // show historical posts as still "Scheduled". DB trigger (migration 037)
    // enforces this server-side too.
    const final: EntryFormValues = isPastDate
      ? { ...values, status: 'published' }
      : values
    await onSave(final)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-md">
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
              : 'Edit this calendar entry’s title, body, platforms, schedule, and assignments.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Entry title…"
            />
          </div>

          {/* Caption / Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Caption / Notes{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              value={values.body}
              onChange={(e) => set('body', e.target.value)}
              rows={5}
              className="resize-none"
              placeholder="Full caption, hook text, script notes…"
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Scheduled date</label>
            <input
              type="date"
              value={values.date}
              onChange={(e) => set('date', e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
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
                  aria-label={`${ct.label} — ${ct.desc}`}
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
                Scheduled date is in the past — entry will save as Published.
              </p>
            )}
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
                className="resize-none text-sm"
              />
            )}
          </div>

          {/* Campaign */}
          {campaigns.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Campaign{' '}
                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
              </label>
              <Select
                value={values.campaignId ?? '__none__'}
                onValueChange={(v) => set('campaignId', v === '__none__' ? null : v)}
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
                  onClick={() => set('pillarId', null)}
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
                    onClick={() => set('pillarId', p.id)}
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

          {/* Assigned Specialist */}
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

          {mode === 'edit' && group?.representative.generated_content_id && (
            <GeneratedContentPreview id={group.representative.generated_content_id} />
          )}
        </div>

        <SheetFooter className="border-t border-border px-6 py-4 flex-row gap-2">
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
            onClick={() => onOpenChange(false)}
            className="ml-auto"
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
