import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BrandProfile } from '@/types'

interface ActiveBrandState {
  activeBrand: BrandProfile | null
  setActiveBrand: (brand: BrandProfile | null) => void
}

export const useActiveBrand = create<ActiveBrandState>()(
  persist(
    (set) => ({
      activeBrand: null,
      setActiveBrand: (brand) => set({ activeBrand: brand }),
    }),
    {
      name: 'zek-studio-active-brand',
      partialize: (state) => ({ activeBrand: state.activeBrand }),
    }
  )
)
