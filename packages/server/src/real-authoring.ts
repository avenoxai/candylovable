import {
  type DeepSeekClient,
  type LibraryJson,
  type Pipeline,
  createPipeline,
  generate,
} from '@candylovable/authoring'
import type { GenerationEvent } from '@candylovable/contract'
import { Engine } from '@candylovable/engine'
import type { AuthoringDeps, AuthoringPort, GenerateInput, IterateInput } from './authoring'
import type { Session } from './store/store'

export interface RealAuthoringConfig {
  apiKey: string
  baseUrl?: string
  /** Model-facing `assets/asset-skill.md` text, injected into the system prompt. */
  assetSkill: string
  /** Parsed `assets/library.json`. */
  library: LibraryJson
  /** Goals the model may use. Default ['score','collect'] — what the engine supports today. */
  goalKinds?: readonly string[]
  maxRounds?: number
  /** Inject a client for hermetic tests; otherwise a real HttpDeepSeekClient is built. */
  client?: DeepSeekClient
}

/**
 * Bridges the backend's {@link AuthoringPort} to deepseek-infra's real pipeline (BE-D10 / BE-O1).
 * The frozen prompt prefix + catalog + client are built ONCE (cache-friendly); each request
 * injects edge volatility (now/ids) + the abort signal, and uses the real {@link Engine} for
 * solvability. Goals are constrained to score+collect — clearJelly/bringDown + runtime
 * blockers await CONTRACT_VERSION 2 (BE-D7/D8), so every generated game is engine-winnable.
 */
export class RealAuthoring implements AuthoringPort {
  private readonly pipeline: Pipeline
  private readonly maxRounds: number

  constructor(cfg: RealAuthoringConfig) {
    this.pipeline = createPipeline({
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      assetSkill: cfg.assetSkill,
      library: cfg.library,
      goalKinds: cfg.goalKinds ?? ['score', 'collect'],
      client: cfg.client,
    })
    this.maxRounds = cfg.maxRounds ?? 36
  }

  async *generate(input: GenerateInput, deps: AuthoringDeps): AsyncIterable<GenerationEvent> {
    yield* generate(input.prompt, {
      client: this.pipeline.client,
      proPrefix: this.pipeline.proPrefix,
      catalog: this.pipeline.catalog,
      makeEngine: () => new Engine(),
      clock: deps.now,
      runId: deps.ids(),
      maxRounds: this.maxRounds,
      signal: deps.signal,
    })
  }

  async *iterate(_input: IterateInput, _deps: AuthoringDeps & { session: Session }): AsyncIterable<GenerationEvent> {
    // iterate (deepseek-infra P4) is deferred; fail gracefully so the FE shows a clear
    // message instead of hanging. Wire the real edit pipeline here when P4 lands.
    yield { type: 'error', message: 'iteration is not available yet (deepseek-infra P4 pending)', recoverable: false }
  }
}
