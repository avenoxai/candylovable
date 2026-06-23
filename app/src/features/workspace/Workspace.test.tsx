import type { GenerationEvent } from '@candylovable/contract'
import { sampleMatch3 } from '@candylovable/mocks'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { EditContext, GenerationStreamFn } from '../../lib/api/sse'
import { resetProjectStore } from '../../store/project'
import { resetSelectionStore } from '../../store/selection'
import { useUiStore } from '../../store/ui'
import { Workspace } from './Workspace'

afterEach(() => {
  useUiStore.setState({ theme: 'dark' })
  document.documentElement.removeAttribute('data-theme')
  resetProjectStore()
  resetSelectionStore()
})

const fakeGenerate =
  (events: GenerationEvent[]): GenerationStreamFn =>
  async function* () {
    for (const e of events) yield e
  }

describe('Workspace', () => {
  it('lays out the chat, the live preview, and the author panel', () => {
    render(<Workspace />)
    expect(screen.getByLabelText('builder chat')).toBeInTheDocument()
    expect(screen.getByLabelText('live preview')).toBeInTheDocument()
    expect(screen.getByLabelText('game board')).toBeInTheDocument()
    expect(screen.getByLabelText('author panel')).toBeInTheDocument()
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

    // timeline shows the streamed step…
    await waitFor(() => expect(screen.getByText('Picking a look')).toBeInTheDocument())
    // …and the finished game is committed as a version + becomes the preview
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: 'version history' })).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /Spooky Ghosts/ })).toBeInTheDocument()
  })

  it('select-and-edit: picking an entity scopes the next prompt to an iteration', async () => {
    const calls: Array<{ prompt: string; context?: EditContext }> = []
    const generate: GenerationStreamFn = async function* (prompt, _signal, context) {
      calls.push({ prompt, context })
      yield { type: 'gameReady', def: { ...sampleMatch3, id: 'edited' } }
      yield { type: 'done' }
    }
    render(<Workspace generate={generate} />)

    // pick the background to edit → a chip appears and the composer becomes "Update"
    fireEvent.click(screen.getByRole('button', { name: /edit Background/i }))
    expect(screen.getByText('Editing')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('prompt'), { target: { value: 'make it midnight blue' } })
    fireEvent.click(screen.getByRole('button', { name: /update/i }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]!.context).toMatchObject({ kind: 'background' })

    // the finished edit consumes the selection (chip gone)
    await waitFor(() => expect(screen.queryByText('Editing')).not.toBeInTheDocument())
  })
})
