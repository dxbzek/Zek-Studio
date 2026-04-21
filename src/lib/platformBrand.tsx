import type { Platform } from '@/types'

type BrandInfo = {
  bg: string            // solid brand background (used behind white logo)
  chip: string          // subtle tinted chip background (for inactive pills)
  text: string          // brand-tinted text (for tables / trend columns)
  slug: string          // simple-icons slug
  hex: string           // brand color without '#', used for Simple Icons CDN
}

export const PLATFORM_BRAND: Record<Platform, BrandInfo> = {
  instagram: {
    bg:   'bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737]',
    chip: 'bg-gradient-to-br from-[#833AB4]/15 via-[#E1306C]/15 to-[#F77737]/15 text-[#C13584] dark:text-[#F77737]',
    text: 'text-[#E1306C] dark:text-[#F77737]',
    slug: 'instagram',
    hex:  'E1306C',
  },
  facebook: {
    bg:   'bg-[#1877F2]',
    chip: 'bg-[#1877F2]/10 text-[#1877F2]',
    text: 'text-[#1877F2]',
    slug: 'facebook',
    hex:  '1877F2',
  },
  tiktok: {
    bg:   'bg-black',
    chip: 'bg-zinc-900/10 text-zinc-900 dark:bg-white/10 dark:text-zinc-100',
    text: 'text-zinc-900 dark:text-zinc-100',
    slug: 'tiktok',
    hex:  '000000',
  },
  linkedin: {
    bg:   'bg-[#0A66C2]',
    chip: 'bg-[#0A66C2]/10 text-[#0A66C2]',
    text: 'text-[#0A66C2]',
    slug: 'linkedin',
    hex:  '0A66C2',
  },
  youtube: {
    bg:   'bg-[#FF0000]',
    chip: 'bg-[#FF0000]/10 text-[#FF0000]',
    text: 'text-[#FF0000]',
    slug: 'youtube',
    hex:  'FF0000',
  },
  twitter: {
    bg:   'bg-black',
    chip: 'bg-zinc-900/10 text-zinc-900 dark:bg-white/10 dark:text-zinc-100',
    text: 'text-zinc-900 dark:text-zinc-100',
    slug: 'x',
    hex:  '000000',
  },
}

// LinkedIn was removed from Simple Icons after a trademark takedown, so the CDN
// returns 404 for every linkedin request. Inline the canonical mark locally.
const LINKEDIN_PATH =
  'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'

/** Logo from Simple Icons CDN (`https://cdn.simpleicons.org/<slug>/<color>`), with an inline fallback for LinkedIn. */
function PlatformLogo({
  platform,
  color = 'white',
  className,
}: {
  platform: Platform
  color?: string
  className?: string
}) {
  if (platform === 'linkedin') {
    const fill = color === 'white' ? '#ffffff' : `#${color.replace(/^#/, '')}`
    return (
      <svg
        viewBox="0 0 24 24"
        fill={fill}
        className={className}
        aria-label="linkedin logo"
        role="img"
      >
        <path d={LINKEDIN_PATH} />
      </svg>
    )
  }
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
  const { bg, chip, hex } = PLATFORM_BRAND[platform]
  const logoColor = active ? 'white' : hex
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium leading-none transition-colors ${
        active ? `${bg} text-white` : chip
      }`}
    >
      <PlatformLogo
        platform={platform}
        color={logoColor}
        className="h-3 w-3 shrink-0"
      />
      {label}
    </span>
  )
}
