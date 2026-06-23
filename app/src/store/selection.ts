import { create } from 'zustand'
import type { EditContext } from '../lib/api/sse'

interface SelectionState {
  /** The previewed entity the user picked to edit, or null when nothing is selected. */
  selected: EditContext | null
  /** Select an entity; picking the same ref again clears it (toggle). */
  select: (target: EditContext) => void
  clear: () => void
}

const sameTarget = (a: EditContext | null, b: EditContext): boolean =>
  a !== null && a.kind === b.kind && a.ref === b.ref

/** Select-and-edit state: which preview entity is attached as edit context. */
export const useSelectionStore = create<SelectionState>((set, get) => ({
  selected: null,
  select: (target) => set({ selected: sameTarget(get().selected, target) ? null : target }),
  clear: () => set({ selected: null }),
}))

/** Test helper — reset to a clean slate between tests. */
export const resetSelectionStore = (): void => useSelectionStore.setState({ selected: null })
