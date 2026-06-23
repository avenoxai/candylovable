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
    try {
      for await (const e of gen) {
        if (onEvent) await onEvent(e)
        await stream.writeSSE({ event: e.type, data: JSON.stringify(e) })
      }
    } catch (err) {
      // A pipeline failure becomes a contract `error` event, then the stream closes
      // cleanly — the FE shows it instead of a dead connection. Nothing is persisted.
      const event: GenerationEvent = {
        type: 'error',
        message: (err as Error)?.message ?? 'generation failed',
        recoverable: false,
      }
      await stream.writeSSE({ event: 'error', data: JSON.stringify(event) })
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
