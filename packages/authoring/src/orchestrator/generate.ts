import type { GameDefinition, GenerationEvent } from '@candylovable/contract'
import type { AssetCatalog } from '../assets/catalog'
import type { ChatMessage, DeepSeekClient, ModelTier } from '../llm/client'
import { costUSD } from '../obs/cost'
import type { StepLogger } from '../obs/logger'
import { type FrozenPrefix, assembleRequest } from '../prompts/assemble'
import { assembleDraft } from '../tools/finalize'
import { buildToolRegistry } from '../tools/tools'
import { type ToolContext, type ToolResult, fail, newDraft } from '../tools/types'
import type { EngineFactory } from '../validate/simulate-level'
import { ev } from './events'

export interface GenerateDeps {
  client: DeepSeekClient
  /** The frozen pro prefix (system + tools), byte-stable across calls. */
  proPrefix: FrozenPrefix
  /** Model tier to run; defaults to 'pro'. */
  tier?: ModelTier
  /** Prefix matching {@link tier}; defaults to {@link proPrefix}. Pass the flash prefix to run flash. */
  prefix?: FrozenPrefix
  catalog?: AssetCatalog
  makeEngine?: EngineFactory
  logger?: StepLogger
  runId?: string
  /** Injected clock for latency logging; defaults to a constant (keeps tests deterministic). */
  clock?: () => number
  /** Hard cap on model rounds — also bounds the repair loop. */
  maxRounds?: number
  /** Optional observer of each tool execution (diagnostics / tiering). */
  onTool?: (name: string, ok: boolean, errors?: string[]) => void
  /** Aborts the run when the client disconnects (the FE stop button). */
  signal?: AbortSignal
}

const STEP_KIND: Record<string, 'design' | 'rules' | 'level' | 'theme' | 'asset'> = {
  select_theme: 'theme',
  set_rules: 'rules',
  author_level: 'level',
  get_theme_assets: 'asset',
  list_themes: 'asset',
  list_shared: 'asset',
  validate_asset_refs: 'asset',
}

/**
 * The generate pipeline: a pro tool-calling loop that drives the standardized tools to
 * assemble a GameDefinition, streaming {@link GenerationEvent}s. Repair is inherent — a failed
 * `finalize`/`validate_game` returns errors as a tool result and the model fixes them on the
 * next round, bounded by `maxRounds`. Pure given an injected client/engine/clock, so the
 * scripted bench replays a trace with zero network.
 */
export async function* generate(prompt: string, deps: GenerateDeps): AsyncGenerator<GenerationEvent> {
  const { client, proPrefix, catalog, makeEngine, logger } = deps
  const tier = deps.tier ?? 'pro'
  const prefix = deps.prefix ?? proPrefix
  const clock = deps.clock ?? (() => 0)
  const maxRounds = deps.maxRounds ?? 36
  const runId = deps.runId ?? 'run'
  const { tools } = buildToolRegistry()
  const ctx: ToolContext = { draft: newDraft(), catalog, makeEngine }
  const messages: ChatMessage[] = [{ role: 'user', content: prompt }]

  yield ev.plan(['select theme', 'set rules', 'author levels', 'validate', 'finalize'])

  let finalized: GameDefinition | undefined
  let stepIndex = 0
  let noToolStreak = 0

  for (let round = 0; round < maxRounds && !finalized; round++) {
    if (deps.signal?.aborted) return // client disconnected — stop streaming
    const startedAt = clock()
    const result = await client.chat(assembleRequest(tier, prefix, { messages }))

    logger?.log({
      runId,
      stepIndex: stepIndex++,
      stepName: `round-${round}`,
      model: 'pro',
      thinking: true,
      promptTokens: result.usage.promptTokens,
      cacheHitTokens: result.usage.cacheHitTokens,
      cacheMissTokens: result.usage.cacheMissTokens,
      completionTokens: result.usage.completionTokens,
      reasoningTokens: result.usage.reasoningTokens,
      costUSD: costUSD('pro', result.usage),
      latencyMs: clock() - startedAt,
      toolCallOk: result.toolCalls.length > 0,
    })

    if (result.toolCalls.length === 0) {
      if (result.content) yield ev.token(result.content)
      if (finalized) break
      // The model answered in prose instead of acting. Nudge it back to tools; give up only
      // if it does this twice in a row (otherwise maxRounds would burn on empty turns).
      noToolStreak += 1
      if (noToolStreak >= 2) break
      messages.push({ role: 'assistant', content: result.content })
      messages.push({ role: 'user', content: 'Keep going — use tools to complete the game, then call finalize. Do not reply in prose.' })
      continue
    }
    noToolStreak = 0

    // Record the assistant's tool calls BEFORE their results (OpenAI/DeepSeek protocol).
    messages.push({ role: 'assistant', content: result.content, toolCalls: result.toolCalls })

    for (const call of result.toolCalls) {
      let res: ToolResult
      try {
        const tool = tools.get(call.name)
        res = tool ? tool.handler(call.arguments, ctx) : fail(`unknown tool ${call.name}`)
      } catch (e) {
        // A tool throwing must not crash generation — turn it into a recoverable error the
        // model can fix next round. The weak model WILL misuse tools; resilience is the point.
        res = fail(`tool ${call.name} failed: ${e instanceof Error ? e.message : String(e)}`)
      }
      deps.onTool?.(call.name, res.ok, res.ok ? undefined : res.errors)
      yield ev.step(call.name, call.name, 'done', STEP_KIND[call.name] ?? 'design')
      if (Object.keys(ctx.draft.def).length > 0) yield ev.partial(ctx.draft.def)
      if (call.name === 'finalize' && res.ok) finalized = res.data as GameDefinition
      messages.push({ role: 'tool', content: JSON.stringify(res), toolCallId: call.id })
    }
  }

  if (!finalized) {
    const assembled = assembleDraft(ctx.draft, catalog)
    if (!assembled.def) {
      yield ev.error(`could not finalize a valid game: ${assembled.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`, false)
      return
    }
    finalized = assembled.def
  }

  yield ev.gameReady(finalized)
  yield ev.done()
}

/** Drain the generator to its terminal result — convenience for callers that only want the def. */
export async function generateToCompletion(prompt: string, deps: GenerateDeps): Promise<{ events: GenerationEvent[]; def?: GameDefinition }> {
  const events: GenerationEvent[] = []
  let def: GameDefinition | undefined
  for await (const e of generate(prompt, deps)) {
    events.push(e)
    if (e.type === 'gameReady') def = e.def
  }
  return { events, def }
}
