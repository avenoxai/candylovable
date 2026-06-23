import type { GameDefinition } from '@candylovable/contract'
import { sampleMatch3 } from '@candylovable/mocks'
import { create } from 'zustand'

export interface Checkpoint {
  id: number
  label: string
  def: GameDefinition
}

interface ProjectState {
  current: GameDefinition
  history: Checkpoint[]
  currentId: number
  /** Record a new version and make it current (e.g. after a generation). */
  commit: (def: GameDefinition, label: string) => void
  /** Restore a past checkpoint as the current preview. */
  restore: (id: number) => void
}

const INITIAL: Checkpoint = { id: 1, label: 'Initial board', def: sampleMatch3 }
let seq = 1

/** Project = the current GameDefinition + a checkpoint history (the safety net). */
export const useProjectStore = create<ProjectState>((set, get) => ({
  current: sampleMatch3,
  history: [INITIAL],
  currentId: INITIAL.id,
  commit: (def, label) => {
    const id = ++seq
    set((s) => ({ current: def, history: [...s.history, { id, label, def }], currentId: id }))
  },
  restore: (id) => {
    const cp = get().history.find((h) => h.id === id)
    if (cp) set({ current: cp.def, currentId: id })
  },
}))

/** Test helper: reset the store to its initial single-checkpoint state. */
export const resetProjectStore = (): void =>
  useProjectStore.setState({ current: sampleMatch3, history: [INITIAL], currentId: INITIAL.id })
