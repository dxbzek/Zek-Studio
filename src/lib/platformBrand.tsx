import { Instagram, Facebook, Linkedin, Youtube, Twitter } from 'lucide-react'
import type { ComponentType } from 'react'
import type { Platform } from '@/types'

export function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19.321 5.562a5.124 5.124 0 0 1-.443-.258 6.228 6.228 0 0 1-1.137-.966c-.849-.971-1.166-1.956-1.282-2.645h.004C16.357 1.137 16.4 1 16.4 1H12.36v15.566c0 .206 0 .41-.008.611 0 .025-.003.049-.004.076 0 .011 0 .022-.002.033v.008a3.35 3.35 0 0 1-1.685 2.657 3.286 3.286 0 0 1-1.628.432c-1.836 0-3.325-1.5-3.325-3.352 0-1.853 1.489-3.353 3.325-3.353.347 0 .682.054.997.154l.005-4.115a7.49 7.49 0 0 0-5.769 1.681 7.911 7.911 0 0 0-1.727 2.131c-.167.296-.799 1.453-.875 3.331-.048 1.066.273 2.17.425 2.626v.01c.096.268.469 1.186 1.076 1.96a8.17 8.17 0 0 0 1.752 1.547v-.011l.011.01c2.469 1.677 5.205 1.567 5.205 1.567.475-.019 2.061 0 3.861-.853 1.997-.946 3.135-2.355 3.135-2.355a8.028 8.028 0 0 0 1.368-2.271c.386-.994.515-2.186.515-2.662V8.212c.062.037.888.582.888.582s1.189.761 3.045 1.258c1.333.353 3.127.427 3.127.427V5.873c-.628.068-1.903-.129-3.209-.77z"/>
    </svg>
  )
}

type BrandInfo = {
  bg: string            // solid brand background (with white text)
  chip: string          // subtle tinted chip background
  text: string          // brand-tinted text (for table rows / trend columns)
  Icon: ComponentType<{ className?: string }>
}

export const PLATFORM_BRAND: Record<Platform, BrandInfo> = {
  instagram: {
    bg:   'bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737] text-white',
    chip: 'bg-gradient-to-br from-[#833AB4]/15 via-[#E1306C]/15 to-[#F77737]/15 text-[#C13584] dark:text-[#F77737]',
    text: 'text-[#E1306C] dark:text-[#F77737]',
    Icon: Instagram,
  },
  facebook: {
    bg:   'bg-[#1877F2] text-white',
    chip: 'bg-[#1877F2]/10 text-[#1877F2]',
    text: 'text-[#1877F2]',
    Icon: Facebook,
  },
  tiktok: {
    bg:   'bg-black text-white',
    chip: 'bg-zinc-900/10 text-zinc-900 dark:bg-white/10 dark:text-zinc-100',
    text: 'text-zinc-900 dark:text-zinc-100',
    Icon: TikTokIcon,
  },
  linkedin: {
    bg:   'bg-[#0A66C2] text-white',
    chip: 'bg-[#0A66C2]/10 text-[#0A66C2]',
    text: 'text-[#0A66C2]',
    Icon: Linkedin,
  },
  youtube: {
    bg:   'bg-[#FF0000] text-white',
    chip: 'bg-[#FF0000]/10 text-[#FF0000]',
    text: 'text-[#FF0000]',
    Icon: Youtube,
  },
  twitter: {
    bg:   'bg-black text-white',
    chip: 'bg-zinc-900/10 text-zinc-900 dark:bg-white/10 dark:text-zinc-100',
    text: 'text-zinc-900 dark:text-zinc-100',
    Icon: Twitter,
  },
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
  const { bg, Icon } = PLATFORM_BRAND[platform]
  const box  = size === 'xs' ? 'h-4 w-4 rounded'   : size === 'sm' ? 'h-5 w-5 rounded-md' : 'h-6 w-6 rounded-md'
  const icon = size === 'xs' ? 'h-2.5 w-2.5'        : size === 'sm' ? 'h-3 w-3'           : 'h-3.5 w-3.5'
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${box} ${bg}`}
      title={title ?? platform}
    >
      <Icon className={icon} />
    </span>
  )
}

/** Pill chip with logo + label text (subtle brand tint). Good for filters / selectors. */
export function PlatformPill({
  platform,
  label,
  active = false,
}: {
  platform: Platform
  label: string
  active?: boolean
}) {
  const { bg, chip, Icon } = PLATFORM_BRAND[platform]
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
        active ? bg : chip
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}
