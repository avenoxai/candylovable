import type { GenerationEvent } from '@candylovable/contract'
import { sampleMatch3 } from '@candylovable/mocks'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { GenerationStreamFn } from '../../lib/api/sse'
import { useGeneration } from './useGeneration'

const fromEvents =
  (events: GenerationEvent[]): GenerationStreamFn =>
  async function* () {
    for (const e of events) yield e
  }

describe('useGeneration', () => {
  it('streams to done, capturing steps, tokens, and the def', async () => {
    const stream = fromEvents([
      { type: 'plan', steps: [] },
      { type: 'step', id: 'r', label: 'Rules', status: 'start', kind: 'rules' },
      { type: 'token', text: 'hi' },
      { type: 'step', id: 'r', label: 'Rules', status: 'done', kind: 'rules' },
      { type: 'gameReady', def: sampleMatch3 },
      { type: 'done' },
    ])
    const { result } = renderHook(() => useGeneration(stream))
    await act(async () => {
      await result.current.start('make a game')
    })
    expect(result.current.status).toBe('done')
    expect(result.current.def).toBeDefined()
    expect(result.current.text).toBe('hi')
    expect(result.current.steps.find((s) => s.id === 'r')?.done).toBe(true)
  })

  it('forwards the edit context and baseId to the stream fn', async () => {
    const seen: Array<{ context?: unknown; baseId?: unknown }> = []
    const stream: GenerationStreamFn = async function* (_p, _signal, context, baseId) {
      seen.push({ context, baseId })
      yield { type: 'done' }
    }
    const { result } = renderHook(() => useGeneration(stream))
    await act(async () => {
      await result.current.start('make it spookier', {
        context: { kind: 'tile', label: 'Tile 1', ref: '0' },
        baseId: 'game-1',
      })
    })
    expect(seen[0]).toEqual({
      context: { kind: 'tile', label: 'Tile 1', ref: '0' },
      baseId: 'game-1',
    })
  })

  it('cancels when stop() is called mid-stream', async () => {
    const stream: GenerationStreamFn = async function* (_p, signal) {
      yield { type: 'plan', steps: [] }
      await new Promise((r) => setTimeout(r, 20))
      if (signal?.aborted) return
      yield { type: 'done' }
    }
    const { result } = renderHook(() => useGeneration(stream))
    let pending!: Promise<void>
    act(() => {
      pending = result.current.start('x')
    })
    act(() => {
      result.current.stop()
    })
    await act(async () => {
      await pending
    })
    expect(result.current.status).toBe('cancelled')
  })

  it('surfaces a stream error', async () => {
    const stream: GenerationStreamFn = async function* () {
      yield { type: 'plan', steps: [] }
      throw new Error('network down')
    }
    const { result } = renderHook(() => useGeneration(stream))
    await act(async () => {
      await result.current.start('x')
    })
    expect(result.current.status).toBe('error')
    expect(result.current.error).toContain('network down')
  })
})
