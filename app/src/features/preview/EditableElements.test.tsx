import { sampleMatch3 } from '@candylovable/mocks'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resetSelectionStore, useSelectionStore } from '../../store/selection'
import { EditableElements } from './EditableElements'

afterEach(resetSelectionStore)

describe('EditableElements', () => {
  it('renders a button per editable entity', () => {
    render(<EditableElements def={sampleMatch3} />)
    expect(screen.getByRole('group', { name: 'editable elements' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit Background/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit Goal/i })).toBeInTheDocument()
  })

  it('attaches the picked entity as the current selection', () => {
    render(<EditableElements def={sampleMatch3} />)
    fireEvent.click(screen.getByRole('button', { name: /edit Background/i }))
    expect(useSelectionStore.getState().selected?.kind).toBe('background')
    expect(screen.getByRole('button', { name: /edit Background/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('toggles a selection off when clicked twice', () => {
    render(<EditableElements def={sampleMatch3} />)
    const btn = screen.getByRole('button', { name: /edit Goal/i })
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(useSelectionStore.getState().selected).toBeNull()
  })
})
