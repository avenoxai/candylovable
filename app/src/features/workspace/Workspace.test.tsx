import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Workspace } from './Workspace'
import { useUiStore } from '../../store/ui'

afterEach(() => {
  useUiStore.setState({ theme: 'dark' })
  document.documentElement.removeAttribute('data-theme')
})

describe('Workspace', () => {
  it('lays out the chat and the live preview', () => {
    render(<Workspace />)
    expect(screen.getByLabelText('builder chat')).toBeInTheDocument()
    expect(screen.getByLabelText('live preview')).toBeInTheDocument()
    expect(screen.getByLabelText('game board')).toBeInTheDocument()
  })

  it('toggles the theme from the top bar', () => {
    render(<Workspace />)
    const toggle = screen.getByRole('button', { name: /toggle theme/i })
    fireEvent.click(toggle)
    expect(document.documentElement.dataset.theme).toBe('light')
    fireEvent.click(toggle)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('fills the composer when an example chip is clicked', () => {
    render(<Workspace />)
    const chip = screen.getByRole('button', { name: /clear jelly in 20 moves/i })
    fireEvent.click(chip)
    expect(screen.getByLabelText('prompt')).toHaveValue(
      'A candy match-3 where you clear jelly in 20 moves',
    )
  })
})
