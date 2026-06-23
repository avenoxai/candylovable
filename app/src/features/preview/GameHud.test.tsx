import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GameHud } from './GameHud'
import type { HudState } from './useMatch3Session'

const base: HudState = {
  score: 1200,
  movesUsed: 5,
  moveLimit: 20,
  movesLeft: 15,
  status: 'playing',
  goalKind: 'score',
  goalProgress: 1200,
  goalTarget: 2000,
}

describe('GameHud', () => {
  it('shows score, moves left, and goal progress', () => {
    render(<GameHud hud={base} />)
    expect(screen.getByText('1200')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '60') // 1200/2000
  })

  it('shows ∞ moves when there is no limit', () => {
    render(<GameHud hud={{ ...base, moveLimit: undefined, movesLeft: null }} />)
    expect(screen.getByText('∞')).toBeInTheDocument()
  })

  it('announces win and loss states', () => {
    const { rerender } = render(<GameHud hud={{ ...base, status: 'won' }} />)
    expect(screen.getByText(/you win/i)).toBeInTheDocument()
    rerender(<GameHud hud={{ ...base, status: 'lost' }} />)
    expect(screen.getByText(/out of moves/i)).toBeInTheDocument()
  })
})
