import { afterEach, describe, expect, it } from 'vitest'
import { resetSelectionStore, useSelectionStore } from './selection'

afterEach(resetSelectionStore)

describe('useSelectionStore', () => {
  it('selects an entity', () => {
    useSelectionStore.getState().select({ kind: 'tile', label: 'Tile 1', ref: '0' })
    expect(useSelectionStore.getState().selected).toEqual({ kind: 'tile', label: 'Tile 1', ref: '0' })
  })

  it('toggles off when the same entity is selected again', () => {
    const { select } = useSelectionStore.getState()
    select({ kind: 'tile', label: 'Tile 1', ref: '0' })
    select({ kind: 'tile', label: 'Tile 1', ref: '0' })
    expect(useSelectionStore.getState().selected).toBeNull()
  })

  it('replaces the selection when a different entity is picked', () => {
    const { select } = useSelectionStore.getState()
    select({ kind: 'tile', label: 'Tile 1', ref: '0' })
    select({ kind: 'background', label: 'Background' })
    expect(useSelectionStore.getState().selected?.kind).toBe('background')
  })

  it('clears the selection', () => {
    useSelectionStore.getState().select({ kind: 'goal', label: 'Goal' })
    useSelectionStore.getState().clear()
    expect(useSelectionStore.getState().selected).toBeNull()
  })
})
