import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { initialGenerationState } from '../generation/reducer'
import { ChatPanel } from './ChatPanel'

const baseProps = {
  generation: initialGenerationState,
  onGenerate: () => {},
  onStop: () => {},
}

describe('ChatPanel', () => {
  it('shows the attached edit context as a chip', () => {
    render(<ChatPanel {...baseProps} context={{ kind: 'background', label: 'Background' }} />)
    const chip = screen.getByRole('status')
    expect(chip).toHaveTextContent('Editing')
    expect(chip).toHaveTextContent('Background')
  })

  it('clears the context from the chip', () => {
    const onClearContext = vi.fn()
    render(
      <ChatPanel
        {...baseProps}
        context={{ kind: 'goal', label: 'Goal' }}
        onClearContext={onClearContext}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /clear selection/i }))
    expect(onClearContext).toHaveBeenCalledOnce()
  })

  it('submits the prompt with the attached context', () => {
    const onGenerate = vi.fn()
    const context = { kind: 'tile' as const, label: 'Tile 1', ref: '0' }
    render(<ChatPanel {...baseProps} onGenerate={onGenerate} context={context} />)
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'make it red' } })
    fireEvent.click(screen.getByRole('button', { name: /update/i }))
    expect(onGenerate).toHaveBeenCalledWith('make it red', context)
  })
})
