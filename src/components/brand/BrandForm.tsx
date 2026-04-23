import { useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Wand2, Upload, X } from 'lucide-react'
import { PLATFORMS } from '@/types'
import type { BrandProfile } from '@/types'
import type { BrandUpsert } from '@/hooks/useBrands'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandAvatar } from '@/components/brand/BrandAvatar'
import { cn } from '@/lib/utils'

const BRAND_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#64748b', '#0f172a',
]

const MAX_AVATAR_BYTES = 5 * 1024 * 1024 // 5 MB

/** Deterministically pick a color from the palette based on the brand name */
function colorFromName(name: string): string {
  if (!name.trim()) return BRAND_COLORS[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return BRAND_COLORS[Math.abs(hash) % BRAND_COLORS.length]
}

/** Validate that a string is a valid 6-digit hex color */
function isValidHex(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

const schema = z.object({
  name: z.string().min(1, 'Brand name is required').max(60),
  niche: z.string().min(1, 'Niche is required').max(100),
  target_location: z.string().max(100).optional(),
  website_url: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  platforms: z.array(z.string()).min(1, 'Select at least one platform'),
  color: z.string().optional(),
  instagram_handle: z.string().max(100).optional(),
  tiktok_handle: z.string().max(100).optional(),
  facebook_handle: z.string().max(100).optional(),
  youtube_handle: z.string().max(100).optional(),
  linkedin_handle: z.string().max(100).optional(),
})

type FormValues = z.infer<typeof schema>

export interface BrandFormSubmit {
  values: BrandUpsert
  avatarFile: File | null
  removeAvatar: boolean
}

interface BrandFormProps {
  defaultValues?: Partial<BrandProfile>
  onSubmit: (payload: BrandFormSubmit) => Promise<void>
  onCancel: () => void
  submitting?: boolean
}

export function BrandForm({ defaultValues, onSubmit, onCancel, submitting }: BrandFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      niche: defaultValues?.niche ?? '',
      target_location: defaultValues?.target_location ?? '',
      website_url: defaultValues?.website_url ?? '',
      platforms: (defaultValues?.platforms as string[]) ?? [],
      color: defaultValues?.color ?? BRAND_COLORS[0],
      instagram_handle: defaultValues?.instagram_handle ?? '',
      tiktok_handle: defaultValues?.tiktok_handle ?? '',
      facebook_handle: defaultValues?.facebook_handle ?? '',
      youtube_handle: defaultValues?.youtube_handle ?? '',
      linkedin_handle: defaultValues?.linkedin_handle ?? '',
    },
  })

  const watchedName = watch('name')
  const watchedColor = watch('color')
  const selectedPlatforms = watch('platforms') as string[]

  // Avatar state. Preview can be (a) a picked-file object URL, (b) the
  // existing avatar_url if unchanged, or (c) null if removed or never set.
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(defaultValues?.avatar_url ?? null)
  const [avatarRemoved, setAvatarRemoved] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please pick an image file')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Image must be under 5 MB')
      return
    }
    setAvatarError(null)
    setAvatarFile(file)
    setAvatarRemoved(false)
    // Release prior object URL if we already had one picked locally.
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function handleRemove() {
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setAvatarFile(null)
    setPreviewUrl(null)
    setAvatarRemoved(true)
    setAvatarError(null)
  }

  function togglePlatform(platform: string) {
    const next = selectedPlatforms.includes(platform)
      ? selectedPlatforms.filter((p) => p !== platform)
      : [...selectedPlatforms, platform]
    setValue('platforms', next, { shouldValidate: true })
  }

  async function handleFormSubmit(values: FormValues) {
    await onSubmit({
      values: values as BrandUpsert,
      avatarFile,
      removeAvatar: avatarRemoved && !avatarFile,
    })
  }

  // Virtual brand object so the preview Avatar reflects the latest form state
  // (name drives initials fallback, color drives bg).
  const previewBrand = {
    name: watchedName || 'Brand',
    color: watchedColor ?? null,
    avatar_url: previewUrl,
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Avatar */}
      <div className="space-y-1.5">
        <Label>Logo</Label>
        <div className="flex items-center gap-3">
          <BrandAvatar brand={previewBrand} size={56} rounded="md" />
          <div className="flex flex-col gap-1">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {previewUrl ? 'Replace' : 'Upload'}
              </Button>
              {previewUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground hover:text-destructive"
                  onClick={handleRemove}
                >
                  <X className="h-3.5 w-3.5" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Square image, up to 5 MB. Falls back to initials if empty.
            </p>
            {avatarError && <p className="text-xs text-destructive">{avatarError}</p>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePick}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">Brand / Client Name</Label>
        <Input id="name" placeholder="e.g. Nike, Acme Corp" {...register('name')} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="niche">Niche</Label>
        <Input id="niche" placeholder="e.g. Fitness, SaaS, Fashion" {...register('niche')} />
        {errors.niche && <p className="text-xs text-destructive">{errors.niche.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="target_location">
          Target Location <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input id="target_location" placeholder="e.g. Dubai, UAE, New York" {...register('target_location')} />
        {errors.target_location && <p className="text-xs text-destructive">{errors.target_location.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="website_url">
          Website URL <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="website_url"
          type="url"
          placeholder="https://example.com"
          {...register('website_url')}
        />
        {errors.website_url && (
          <p className="text-xs text-destructive">{errors.website_url.message}</p>
        )}
      </div>

      {/* Platforms */}
      <div className="space-y-2">
        <Label>Platforms</Label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => togglePlatform(value)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                selectedPlatforms.includes(value)
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {errors.platforms && (
          <p className="text-xs text-destructive">{errors.platforms.message}</p>
        )}
      </div>

      {/* Social handles (shown per selected platform, used for analytics sync) */}
      {(
        [
          { platform: 'instagram', field: 'instagram_handle', label: 'Instagram handle', placeholder: '@brandname' },
          { platform: 'tiktok',    field: 'tiktok_handle',    label: 'TikTok handle',    placeholder: '@brandname' },
          { platform: 'facebook',  field: 'facebook_handle',  label: 'Facebook page',    placeholder: 'pagename' },
          { platform: 'youtube',   field: 'youtube_handle',   label: 'YouTube channel',    placeholder: '@channelname' },
          { platform: 'linkedin',  field: 'linkedin_handle',  label: 'LinkedIn company page', placeholder: 'company-slug' },
        ] as const
      )
        .filter(({ platform }) => selectedPlatforms.includes(platform))
        .map(({ field, label, placeholder }) => (
          <div key={field} className="space-y-1.5">
            <Label htmlFor={field}>
              {label}{' '}
              <span className="text-muted-foreground font-normal text-xs">(for analytics sync)</span>
            </Label>
            <Input id={field} placeholder={placeholder} {...register(field)} />
          </div>
        ))
      }

      {/* Color Picker */}
      <Controller
        control={control}
        name="color"
        render={({ field }) => {
          const currentColor = field.value || BRAND_COLORS[0]

          function handleHexInput(e: React.ChangeEvent<HTMLInputElement>) {
            const val = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value
            field.onChange(val)
          }

          return (
            <div className="space-y-2.5">
              <Label>Brand Color</Label>

              {/* Swatches */}
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Brand color">
                {BRAND_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => field.onChange(color)}
                    style={{ background: color }}
                    className={cn(
                      'h-7 w-7 rounded-full transition-all duration-150',
                      field.value === color
                        ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110'
                        : 'hover:scale-110 opacity-80 hover:opacity-100'
                    )}
                    title={color}
                    role="radio"
                    aria-checked={field.value === color}
                    aria-label={`Brand color ${color}`}
                  />
                ))}
              </div>

              {/* Hex input + preview + auto button */}
              <div className="flex items-center gap-2">
                {/* Live preview circle */}
                <div
                  className="h-8 w-8 shrink-0 rounded-full border border-border shadow-sm"
                  style={{ background: isValidHex(currentColor) ? currentColor : '#6366f1' }}
                />

                {/* Hex text input */}
                <Input
                  value={currentColor}
                  onChange={handleHexInput}
                  placeholder="#6366f1"
                  maxLength={7}
                  className="font-mono text-sm h-8 w-28"
                />

                {/* Native color picker */}
                <div className="relative">
                  <input
                    type="color"
                    value={isValidHex(currentColor) ? currentColor : '#6366f1'}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    title="Pick a custom color"
                  />
                  <Button type="button" variant="outline" size="sm" className="h-8 pointer-events-none">
                    Pick
                  </Button>
                </div>

                {/* Auto-generate from name */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-muted-foreground"
                  onClick={() => field.onChange(colorFromName(watchedName))}
                  title="Auto-generate color from brand name"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Auto
                </Button>
              </div>
            </div>
          )
        }}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : defaultValues?.id ? 'Save changes' : 'Create brand'}
        </Button>
      </div>
    </form>
  )
}
