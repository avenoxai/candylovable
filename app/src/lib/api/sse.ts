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
 * Stream generation events from the pipeline. Uses fetch + ReadableStream (NOT
 * EventSource — we need auth headers + AbortController for the stop button).
 */
export async function* streamGeneration(
  prompt: string,
  signal?: AbortSignal,
): AsyncGenerator<GenerationEvent> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
    ...(signal ? { signal } : {}),
  })
  if (!res.body) throw new Error('generation response had no body')
  for await (const event of parseSSE(res.body)) {
    yield event as GenerationEvent
  }
}

export type GenerationStreamFn = (
  prompt: string,
  signal?: AbortSignal,
) => AsyncIterable<GenerationEvent>
