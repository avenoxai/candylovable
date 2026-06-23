import type { GenerationEvent } from '@candylovable/contract'
import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'

/**
 * Pipe an `AsyncIterable<GenerationEvent>` to the client as SSE (`event:`/`data:` frames),
 * invoking `onEvent` first for persistence side-effects (e.g. saving a finalized def).
 * The contract mandates fetch + ReadableStream on the FE (NOT EventSource); `streamSSE`
 * also wires client-disconnect → abort, which the generator observes via `deps.signal`.
 */
export const streamGeneration = (
  c: Context,
  gen: AsyncIterable<GenerationEvent>,
  onEvent?: (e: GenerationEvent) => Promise<void> | void,
) => {
  // Defeat proxy buffering so the stream is realtime (Polaroid UX).
  c.header('X-Accel-Buffering', 'no')
  c.header('Cache-Control', 'no-cache, no-transform')
  return streamSSE(c, async (stream) => {
    for await (const e of gen) {
      if (onEvent) await onEvent(e)
      await stream.writeSSE({ event: e.type, data: JSON.stringify(e) })
    }
  })
}

/** Parse an SSE response body into its GenerationEvents (test/helper utility). */
export const parseSSE = (text: string): GenerationEvent[] =>
  text
    .split('\n\n')
    .map((block) => block.split('\n').find((l) => l.startsWith('data:')))
    .filter((l): l is string => l !== undefined)
    .map((l) => JSON.parse(l.slice('data:'.length).trim()) as GenerationEvent)
