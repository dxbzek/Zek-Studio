import { describe, it, expect, beforeEach } from 'vitest'
import { useActiveBrand } from '../activeBrand'
import type { BrandProfile } from '@/types'

const mockBrand: BrandProfile = {
  id: 'brand-1',
  user_id: 'user-1',
  name: 'Test Brand',
  niche: 'fitness',
  website_url: null,
  platforms: ['instagram'],
  avatar_url: null,
  color: null,
  target_location: null,
  instagram_handle: null,
  tiktok_handle: null,
  facebook_handle: null,
  youtube_handle: null,
  linkedin_handle: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  useActiveBrand.getState().setActiveBrand(null)
})

describe('useActiveBrand store', () => {
  it('starts with null activeBrand', () => {
    expect(useActiveBrand.getState().activeBrand).toBeNull()
  })

  it('sets activeBrand', () => {
    useActiveBrand.getState().setActiveBrand(mockBrand)
    expect(useActiveBrand.getState().activeBrand).toEqual(mockBrand)
  })

  it('clears activeBrand when set to null', () => {
    useActiveBrand.getState().setActiveBrand(mockBrand)
    useActiveBrand.getState().setActiveBrand(null)
    expect(useActiveBrand.getState().activeBrand).toBeNull()
  })

  it('replaces activeBrand with a new brand', () => {
    const anotherBrand: BrandProfile = { ...mockBrand, id: 'brand-2', name: 'Other Brand' }
    useActiveBrand.getState().setActiveBrand(mockBrand)
    useActiveBrand.getState().setActiveBrand(anotherBrand)
    expect(useActiveBrand.getState().activeBrand?.id).toBe('brand-2')
  })
})
