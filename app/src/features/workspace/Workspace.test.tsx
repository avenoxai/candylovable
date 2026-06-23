import type { GenerationEvent } from '@candylovable/contract'
import { sampleMatch3 } from '@candylovable/mocks'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { GenerationStreamFn } from '../../lib/api/sse'
import { useUiStore } from '../../store/ui'
import { Workspace } from './Workspace'

afterEach(() => {
  useUiStore.setState({ theme: 'dark' })
  document.documentElement.removeAttribute('data-theme')
})

const fakeGenerate =
  (events: GenerationEvent[]): GenerationStreamFn =>
  async function* () {
    for (const e of events) yield e
  }

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
    fireEvent.click(screen.getByRole('button', { name: /clear jelly in 20 moves/i }))
    expect(screen.getByLabelText('prompt')).toHaveValue(
      'A candy match-3 where you clear jelly in 20 moves',
    )
  })

  it('streams a generation and swaps the previewed game', async () => {
    const events: GenerationEvent[] = [
      { type: 'plan', steps: ['Pick a look'] },
      { type: 'step', id: 'design', label: 'Picking a look', status: 'start', kind: 'design' },
      { type: 'step', id: 'design', label: 'Picking a look', status: 'done', kind: 'design' },
      { type: 'gameReady', def: { ...sampleMatch3, id: 'gen', meta: { ...sampleMatch3.meta, title: 'Spooky Ghosts' } } },
      { type: 'done' },
    ]
    render(<Workspace generate={fakeGenerate(events)} />)
    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'spooky ghost match' } })
    fireEvent.click(screen.getByRole('button', { name: /generate/i }))

    // timeline shows the streamed step, and the preview title updates to the new game
    await waitFor(() => expect(screen.getByText('Picking a look')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText(/Spooky Ghosts/)).toBeInTheDocument())
  })
})
