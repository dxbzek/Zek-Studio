import { create } from 'zustand'

// Cross-page UI flags for chrome that has to coordinate with one specific
// page's local state. Right now only the calendar's select-mode needs this:
// the AppShell mobile FAB has to hide while the calendar shows its bulk-edit
// bar so the two never compete for the bottom-right position.
//
// Don't grow this without a clear cross-component need. If a piece of state
// is owned by one page, keep it in that page.
interface UiState {
  calendarSelectMode: boolean
  setCalendarSelectMode: (active: boolean) => void
}

export const useUiState = create<UiState>((set) => ({
  calendarSelectMode: false,
  setCalendarSelectMode: (active) => set({ calendarSelectMode: active }),
}))
