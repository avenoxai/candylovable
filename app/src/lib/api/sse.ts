import type { GenerationEvent } from '@candylovable/contract'

/** Parse an SSE `ReadableStream` into successive `data:` JSON payloads. */
export async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let sep: number
      while ((sep = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, sep)
        buf = buf.slice(sep + 2)
        const line = chunk.split('\n').find((l) => l.startsWith('data:'))
        if (line) {
          const json = line.slice(5).trim()
          if (json) yield JSON.parse(json)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * A previewed entity the user picked to edit (select-and-edit). Sent as context
 * with an iteration so the change is scoped to "this tile / the background / the
 * goal" instead of the whole game. FE-local for now — not a contract type.
 */
export interface EditContext {
  kind: 'tile' | 'background' | 'goal' | 'board'
  /** Human label shown in the chip, e.g. "Tile 3" or "Background". */
  label: string
  /** Stable reference (e.g. the colorId for a tile). */
  ref?: string
}

async function* streamSSE(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<GenerationEvent> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  })
  if (!res.body) throw new Error('generation response had no body')
  for await (const event of parseSSE(res.body)) {
    yield event as GenerationEvent
  }
}

/**
 * Stream generation events from the pipeline. Uses fetch + ReadableStream (NOT
 * EventSource — we need auth headers + AbortController for the stop button).
 */
export function streamGeneration(
  prompt: string,
  signal?: AbortSignal,
): AsyncGenerator<GenerationEvent> {
  return streamSSE('/api/generate', { prompt }, signal)
}

/**
 * Iterate on the current game: a follow-up `message`, optionally scoped to a
 * selected `context` entity, against a base game (`baseId`).
 */
export function streamIteration(
  message: string,
  context: EditContext | undefined,
  baseId: string | undefined,
  signal?: AbortSignal,
): AsyncGenerator<GenerationEvent> {
  return streamSSE('/api/iterate', { message, context, baseId }, signal)
}

/**
 * The unified builder stream the hook uses by default: routes to iteration when an
 * edit `context` is attached or a `baseId` exists, otherwise a fresh generation.
 */
export function streamBuilder(
  prompt: string,
  signal?: AbortSignal,
  context?: EditContext,
  baseId?: string,
): AsyncGenerator<GenerationEvent> {
  if (context || baseId) return streamIteration(prompt, context, baseId, signal)
  return streamGeneration(prompt, signal)
}

export type GenerationStreamFn = (
  prompt: string,
  signal?: AbortSignal,
  context?: EditContext,
  baseId?: string,
) => AsyncIterable<GenerationEvent>
