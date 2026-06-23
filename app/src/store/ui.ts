import { create } from 'zustand'

export type Theme = 'dark' | 'light'

interface UiState {
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void
}

const applyTheme = (t: Theme): void => {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = t
}

/** Client UI state (theme, …). Server state lives in TanStack Query, not here. */
export const useUiStore = create<UiState>((set, get) => ({
  theme: 'dark',
  setTheme: (t) => {
    applyTheme(t)
    set({ theme: t })
  },
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    set({ theme: next })
  },
}))
