import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ActionTimeline } from './ActionTimeline'
import type { GenerationState } from './reducer'

const streaming: GenerationState = {
  status: 'streaming',
  steps: [
    { id: 'design', label: 'Picking a look', kind: 'design', done: true },
    { id: 'rules', label: 'Setting the rules', kind: 'rules', done: false },
  ],
  text: 'An 8×8 match-3',
  directions: [],
}

describe('ActionTimeline', () => {
  it('lists streamed steps + text and offers a stop button', () => {
    const onStop = vi.fn()
    render(<ActionTimeline state={streaming} onStop={onStop} />)
    expect(screen.getByText('Picking a look')).toBeInTheDocument()
    expect(screen.getByText('Setting the rules')).toBeInTheDocument()
    expect(screen.getByText(/8×8 match-3/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /stop/i }))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('hides stop when not streaming', () => {
    render(<ActionTimeline state={{ ...streaming, status: 'done' }} onStop={() => {}} />)
    expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument()
  })

  it('shows an alert on error', () => {
    render(
      <ActionTimeline
        state={{ status: 'error', steps: [], text: '', directions: [], error: 'boom' }}
        onStop={() => {}}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('boom')
  })
})
