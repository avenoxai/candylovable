import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { resetProjectStore, useProjectStore } from '../../store/project'
import { AuthorPanel } from './AuthorPanel'

afterEach(resetProjectStore)

describe('AuthorPanel', () => {
  it('switches the theme of the current preview', () => {
    render(<AuthorPanel />)
    expect(useProjectStore.getState().current.theme.id).toBe('gems')
    fireEvent.click(screen.getByRole('button', { name: 'candy' }))
    expect(useProjectStore.getState().current.theme.id).toBe('candy')
    expect(screen.getByRole('button', { name: 'candy' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('edits juice intensity', () => {
    render(<AuthorPanel />)
    fireEvent.change(screen.getByLabelText('particles'), { target: { value: '0.3' } })
    expect(useProjectStore.getState().current.juice.particles).toBe(0.3)
  })

  it('edits the level goal and move limit', () => {
    render(<AuthorPanel />)
    fireEvent.change(screen.getByLabelText('goal target'), { target: { value: '3500' } })
    fireEvent.change(screen.getByLabelText('move limit'), { target: { value: '18' } })
    const lvl = useProjectStore.getState().current.levels[0]!
    expect(lvl.goal.target).toBe(3500)
    expect(lvl.moveLimit).toBe(18)
  })

  it('saves a version (checkpoint) of the edited game', () => {
    render(<AuthorPanel />)
    expect(useProjectStore.getState().history).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /save version/i }))
    expect(useProjectStore.getState().history).toHaveLength(2)
  })

  it('publishes a share link', () => {
    render(<AuthorPanel />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /publish/i }))
    expect(screen.getByRole('status')).toHaveTextContent('candylovable.app/p/')
  })
})
