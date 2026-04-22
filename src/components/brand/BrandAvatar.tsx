import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { BrandProfile } from '@/types'

interface BrandAvatarProps {
  brand: Pick<BrandProfile, 'name' | 'color' | 'avatar_url'> | null
  size?: number
  rounded?: 'md' | 'full'
  className?: string
}

export function BrandAvatar({
  brand,
  size = 38,
  rounded = 'md',
  className,
}: BrandAvatarProps) {
  const [imgOk, setImgOk] = useState(true)
  const url = brand?.avatar_url?.trim()
  const showImg = !!url && imgOk

  const initials = brand?.name
    ? brand.name.slice(0, 2).toUpperCase()
    : 'ZS'
  const bg = brand?.color ?? '#B8C5D1'
  const radius = rounded === 'full' ? '9999px' : Math.max(6, Math.round(size * 0.21)) + 'px'

  return (
    <div
      className={cn('shrink-0 overflow-hidden', className)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: showImg ? 'transparent' : bg,
      }}
    >
      {showImg ? (
        <img
          src={url}
          alt={brand?.name ?? 'Brand avatar'}
          onError={() => setImgOk(false)}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-bold text-white"
          style={{ fontSize: Math.max(10, Math.round(size * 0.3)) }}
        >
          {initials}
        </div>
      )}
    </div>
  )
}
