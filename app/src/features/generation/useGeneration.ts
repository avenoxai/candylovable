import { useCallback, useRef, useState } from 'react'
import { type EditContext, type GenerationStreamFn, streamBuilder } from '../../lib/api/sse'
import { type GenerationState, initialGenerationState, reduceGeneration } from './reducer'

export interface StartOptions {
  /** A selected preview entity to scope the edit (select-and-edit). */
  context?: EditContext
  /** The id of the game being iterated on. */
  baseId?: string
}

/**
 * Drives a generation stream into {@link GenerationState}. `streamFn` is injectable
 * so tests can feed a fake async iterable; the default routes generate vs iterate.
 */
export const useGeneration = (streamFn: GenerationStreamFn = streamBuilder) => {
  const [state, setState] = useState<GenerationState>(initialGenerationState)
  const ctrlRef = useRef<AbortController | null>(null)

  const start = useCallback(
    async (prompt: string, opts: StartOptions = {}): Promise<void> => {
      ctrlRef.current?.abort()
      const ctrl = new AbortController()
      ctrlRef.current = ctrl
      setState({ ...initialGenerationState, status: 'streaming' })
      try {
        for await (const event of streamFn(prompt, ctrl.signal, opts.context, opts.baseId)) {
          if (ctrl.signal.aborted) break
          setState((prev) => reduceGeneration(prev, event))
        }
        if (ctrl.signal.aborted) {
          setState((prev) => ({ ...prev, status: 'cancelled' }))
        } else {
          setState((prev) => (prev.status === 'error' ? prev : { ...prev, status: 'done' }))
        }
      } catch (err) {
        if (ctrl.signal.aborted) setState((prev) => ({ ...prev, status: 'cancelled' }))
        else setState((prev) => ({ ...prev, status: 'error', error: String(err) }))
      }
    },
    [streamFn],
  )

  const stop = useCallback((): void => {
    ctrlRef.current?.abort()
  }, [])

  const reset = useCallback((): void => {
    ctrlRef.current?.abort()
    setState(initialGenerationState)
  }, [])

  return { ...state, start, stop, reset }
}
