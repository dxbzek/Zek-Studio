import type { Platform } from '@/types'

type BrandInfo = {
  bg: string            // solid brand background (used behind white logo)
  chip: string          // subtle tinted chip background (for inactive pills)
  text: string          // brand-tinted text (for tables / trend columns)
  slug: string          // simple-icons slug
}

export const PLATFORM_BRAND: Record<Platform, BrandInfo> = {
  instagram: {
    bg:   'bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737]',
    chip: 'bg-gradient-to-br from-[#833AB4]/15 via-[#E1306C]/15 to-[#F77737]/15 text-[#C13584] dark:text-[#F77737]',
    text: 'text-[#E1306C] dark:text-[#F77737]',
    slug: 'instagram',
  },
  facebook: {
    bg:   'bg-[#1877F2]',
    chip: 'bg-[#1877F2]/10 text-[#1877F2]',
    text: 'text-[#1877F2]',
    slug: 'facebook',
  },
  tiktok: {
    bg:   'bg-black',
    chip: 'bg-zinc-900/10 text-zinc-900 dark:bg-white/10 dark:text-zinc-100',
    text: 'text-zinc-900 dark:text-zinc-100',
    slug: 'tiktok',
  },
  linkedin: {
    bg:   'bg-[#0A66C2]',
    chip: 'bg-[#0A66C2]/10 text-[#0A66C2]',
    text: 'text-[#0A66C2]',
    slug: 'linkedin',
  },
  youtube: {
    bg:   'bg-[#FF0000]',
    chip: 'bg-[#FF0000]/10 text-[#FF0000]',
    text: 'text-[#FF0000]',
    slug: 'youtube',
  },
  twitter: {
    bg:   'bg-black',
    chip: 'bg-zinc-900/10 text-zinc-900 dark:bg-white/10 dark:text-zinc-100',
    text: 'text-zinc-900 dark:text-zinc-100',
    slug: 'x',
  },
}

/** Logo from Simple Icons CDN (`https://cdn.simpleicons.org/<slug>/<color>`). */
function PlatformLogo({
  platform,
  color = 'white',
  className,
}: {
  platform: Platform
  color?: string
  className?: string
}) {
  const { slug } = PLATFORM_BRAND[platform]
  return (
    <img
      src={`https://cdn.simpleicons.org/${slug}/${color}`}
      alt={`${platform} logo`}
      className={className}
      loading="lazy"
      decoding="async"
    />
  )
}

/** Small square badge with brand color + logo only. */
export function PlatformBadge({
  platform,
  size = 'sm',
  title,
}: {
  platform: Platform
  size?: 'xs' | 'sm' | 'md'
  title?: string
}) {
  const { bg } = PLATFORM_BRAND[platform]
  const box  = size === 'xs' ? 'h-4 w-4 rounded'   : size === 'sm' ? 'h-5 w-5 rounded-md' : 'h-6 w-6 rounded-md'
  const icon = size === 'xs' ? 'h-2.5 w-2.5'        : size === 'sm' ? 'h-3 w-3'           : 'h-3.5 w-3.5'
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${box} ${bg}`}
      title={title ?? platform}
    >
      <PlatformLogo platform={platform} color="white" className={icon} />
    </span>
  )
}

/** Pill chip with logo + label text. Good for filters / selectors. */
export function PlatformPill({
  platform,
  label,
  active = false,
}: {
  platform: Platform
  label: string
  active?: boolean
}) {
  const { bg, chip, slug } = PLATFORM_BRAND[platform]
  const logoColor = active ? 'white' : slug === 'tiktok' || slug === 'x' ? '000000' : slug
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
        active ? `${bg} text-white` : chip
      }`}
    >
      <PlatformLogo
        platform={platform}
        color={logoColor}
        className="h-3 w-3"
      />
      {label}
    </span>
  )
}
