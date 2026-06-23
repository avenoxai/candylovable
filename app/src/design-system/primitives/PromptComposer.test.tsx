import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PromptComposer } from './PromptComposer'

describe('PromptComposer', () => {
  it('disables submit when empty and enables it with content', () => {
    const { rerender } = render(<PromptComposer value="" onChange={() => {}} onSubmit={() => {}} />)
    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled()
    rerender(<PromptComposer value="hi" onChange={() => {}} onSubmit={() => {}} />)
    expect(screen.getByRole('button', { name: /generate/i })).toBeEnabled()
  })

  it('submits on Enter, newlines on Shift+Enter', () => {
    const onSubmit = vi.fn()
    render(<PromptComposer value="make a game" onChange={() => {}} onSubmit={onSubmit} />)
    const ta = screen.getByLabelText('prompt')
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true })
    expect(onSubmit).not.toHaveBeenCalled()
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('does not submit Enter when empty', () => {
    const onSubmit = vi.fn()
    render(<PromptComposer value="   " onChange={() => {}} onSubmit={onSubmit} />)
    fireEvent.keyDown(screen.getByLabelText('prompt'), { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('emits typed text via onChange', () => {
    const onChange = vi.fn()
    render(<PromptComposer value="" onChange={onChange} onSubmit={() => {}} />)
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'puzzle' } })
    expect(onChange).toHaveBeenCalledWith('puzzle')
  })
})
