import type { GenerationEvent, SelectionContext } from '@candylovable/contract'
import type { analyzeLevel } from '@candylovable/engine'
import type { Session } from './store/store'

/**
 * What the generation pipeline receives from the backend host. Volatility (ids/now/rng)
 * is edge-supplied (BE-D6); the engine oracle + asset library are injected so the
 * pipeline never imports them directly.
 *
 * BE-O1 (proposed): the canonical shape should live in `@candylovable/contract` so both
 * lanes import one source. deepseek-infra's real `generate(prompt, GenerateDeps)` uses a
 * richer deps (DeepSeekClient + frozen proPrefix + `makeEngine`); the P8 adapter bridges
 * this port to theirs, injecting our `createEngine` as their `makeEngine` (BE-D3).
 */
export interface AuthoringDeps {
  ids: () => string
  now: () => number
  rng: () => number
  analyzeLevel: typeof analyzeLevel
  /** Parsed `library.json` — the model's "eye". */
  library: unknown
  session?: Session
  /** Cancels in-flight work when the client disconnects (the FE stop button). */
  signal?: AbortSignal
}

export interface GenerateInput {
  prompt: string
}

export interface IterateInput {
  sessionId: string
  message: string
  selection?: SelectionContext
}

/**
 * The seam the backend hosts as `/api/generate` + `/api/iterate` SSE. deepseek-infra
 * ships the real implementation as a library; until then `FakeAuthoring` stands in
 * (BE-D10) so the routes are fully built + tested hermetically (no network/DeepSeek).
 */
export interface AuthoringPort {
  generate(input: GenerateInput, deps: AuthoringDeps): AsyncIterable<GenerationEvent>
  iterate(input: IterateInput, deps: AuthoringDeps & { session: Session }): AsyncIterable<GenerationEvent>
}
