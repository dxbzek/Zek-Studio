// Brand slug helpers — derive a URL-friendly slug from a brand name and
// look up a brand by slug. We don't store slugs in the DB; computing them
// from `name` keeps the brand row simple and means a brand rename
// produces a new slug automatically (the old URL stops resolving, which
// is the desired behavior).

import type { BrandProfile } from '@/types'

export function brandSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function findBrandBySlug(
  brands: BrandProfile[] | undefined,
  slug: string | null,
): BrandProfile | null {
  if (!brands || !slug) return null
  const target = slug.toLowerCase().trim()
  return brands.find((b) => brandSlug(b.name) === target) ?? null
}
