import type { GenerationEvent } from '@candylovable/contract'
import { generationHandlers } from '@candylovable/mocks'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { parseSSE, streamBuilder, streamGeneration, streamIteration } from './sse'

const streamOf = (text: string): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(text))
      c.close()
    },
  })

describe('parseSSE', () => {
  it('yields each data payload', async () => {
    const out: unknown[] = []
    for await (const e of parseSSE(streamOf('data: {"type":"a"}\n\ndata: {"type":"b"}\n\n'))) out.push(e)
    expect(out).toEqual([{ type: 'a' }, { type: 'b' }])
  })

  it('reassembles a payload split across chunks', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        const enc = new TextEncoder()
        c.enqueue(enc.encode('data: {"ty'))
        c.enqueue(enc.encode('pe":"x"}\n\n'))
        c.close()
      },
    })
    const out: unknown[] = []
    for await (const e of parseSSE(body)) out.push(e)
    expect(out).toEqual([{ type: 'x' }])
  })
})

describe('streamGeneration against the MSW pipeline', () => {
  const server = setupServer(...generationHandlers)
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  it('streams the mocked pipeline through to gameReady + done', async () => {
    const events: GenerationEvent[] = []
    for await (const e of streamGeneration('a gem match game')) events.push(e)
    expect(events[0]!.type).toBe('plan')
    expect(events.some((e) => e.type === 'gameReady')).toBe(true)
    expect(events.at(-1)!.type).toBe('done')
  })

  it('iterates through the /api/iterate endpoint with a scoped context', async () => {
    const events: GenerationEvent[] = []
    for await (const e of streamIteration(
      'make it spookier',
      { kind: 'background', label: 'Background' },
      'game-1',
    )) {
      events.push(e)
    }
    expect(events.some((e) => e.type === 'gameReady')).toBe(true)
    expect(events.at(-1)!.type).toBe('done')
  })

  it('streamBuilder routes to iteration when an edit context is attached', async () => {
    const events: GenerationEvent[] = []
    for await (const e of streamBuilder('tweak this', undefined, {
      kind: 'tile',
      label: 'Tile 1',
      ref: '0',
    })) {
      events.push(e)
    }
    expect(events.at(-1)!.type).toBe('done')
  })
})
