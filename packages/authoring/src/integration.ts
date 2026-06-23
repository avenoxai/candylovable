import { AssetCatalog, type LibraryJson } from './assets/catalog'
import { DEEPSEEK_BASE_URL } from './config'
import type { DeepSeekClient } from './llm/client'
import { HttpDeepSeekClient } from './llm/http'
import type { FrozenPrefix } from './prompts/assemble'
import { buildPrefixes, compactDigest } from './prompts/system'
import { buildToolRegistry } from './tools/tools'

export interface PipelineConfig {
  apiKey: string
  baseUrl?: string
  /** The model-facing `assets/asset-skill.md` text, injected into the system prompt. */
  assetSkill: string
  /** Parsed `assets/library.json`. */
  library: LibraryJson
  /** Goal kinds the model may use. Default full set; backend v1 passes ['score','collect']. */
  goalKinds?: readonly string[]
  /** Inject a client for hermetic tests; otherwise an HttpDeepSeekClient is built. */
  client?: DeepSeekClient
}

/** The reusable, byte-stable pipeline pieces — built ONCE and shared across requests. */
export interface Pipeline {
  client: DeepSeekClient
  /** The frozen pro prefix (system + tools); identical across calls → hits the prefix cache. */
  proPrefix: FrozenPrefix
  catalog: AssetCatalog
}

/**
 * Build the pipeline once at host startup: the catalog, the frozen prompt prefix (so it
 * caches), and the DeepSeek client. The backend's authoring adapter calls this, then passes
 * `client`/`proPrefix`/`catalog` into `generate()` per request along with edge volatility.
 */
export function createPipeline(cfg: PipelineConfig): Pipeline {
  const catalog = new AssetCatalog(cfg.library)
  const { defs } = buildToolRegistry()
  const { pro } = buildPrefixes({
    assetSkill: cfg.assetSkill,
    digest: compactDigest(catalog),
    tools: defs,
    goalKinds: cfg.goalKinds,
  })
  const client = cfg.client ?? new HttpDeepSeekClient({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl ?? DEEPSEEK_BASE_URL })
  return { client, proPrefix: pro, catalog }
}
