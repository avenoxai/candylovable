import { HttpResponse, http } from 'msw'
import { mockGenerationEvents } from './generation'

const sseStream = (prompt: string): ReadableStream<Uint8Array> => {
  const events = mockGenerationEvents(prompt)
  const enc = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const e of events) controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`))
      controller.close()
    },
  })
}

const readPrompt = async (request: Request): Promise<string> => {
  try {
    const body = (await request.json()) as { prompt?: string; message?: string }
    return body.prompt ?? body.message ?? ''
  } catch {
    return ''
  }
}

const sse = async ({ request }: { request: Request }) =>
  new HttpResponse(sseStream(await readPrompt(request)), {
    headers: { 'Content-Type': 'text/event-stream' },
  })

/** MSW handlers for the mocked generation pipeline (FE dev worker + tests). */
export const generationHandlers = [http.post('*/api/generate', sse), http.post('*/api/iterate', sse)]
