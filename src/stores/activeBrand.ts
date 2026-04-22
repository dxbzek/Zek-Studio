import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { BrandProfile } from '@/types'

interface ActiveBrandState {
  activeBrand: BrandProfile | null
  setActiveBrand: (brand: BrandProfile | null) => void
}

// Fall back to an in-memory store in environments where localStorage is
// blocked (sandboxed iframes, hardened private-browsing modes). Without this
// guard, zustand's default silently throws and persistence is dropped.
const safeStorage = createJSONStorage(() => {
  try {
    const key = '__zek_probe__'
    window.localStorage.setItem(key, '1')
    window.localStorage.removeItem(key)
    return window.localStorage
  } catch {
    const mem = new Map<string, string>()
    return {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => { mem.set(k, v) },
      removeItem: (k) => { mem.delete(k) },
    }
  }
})

export const useActiveBrand = create<ActiveBrandState>()(
  persist(
    (set) => ({
      activeBrand: null,
      setActiveBrand: (brand) => set({ activeBrand: brand }),
    }),
    {
      name: 'zek-studio-active-brand',
      storage: safeStorage,
      partialize: (state) => ({ activeBrand: state.activeBrand }),
    }
  )
)
