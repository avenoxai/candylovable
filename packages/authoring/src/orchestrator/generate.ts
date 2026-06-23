import type { GameDefinition, GenerationEvent } from '@candylovable/contract'
import type { AssetCatalog } from '../assets/catalog'
import type { ChatMessage, DeepSeekClient } from '../llm/client'
import { costUSD } from '../obs/cost'
import type { StepLogger } from '../obs/logger'
import { type FrozenPrefix, assembleRequest } from '../prompts/assemble'
import { assembleDraft } from '../tools/finalize'
import { buildToolRegistry } from '../tools/tools'
import { type ToolContext, fail, newDraft } from '../tools/types'
import type { EngineFactory } from '../validate/simulate-level'
import { ev } from './events'

export interface GenerateDeps {
  client: DeepSeekClient
  /** The frozen pro prefix (system + tools), byte-stable across calls. */
  proPrefix: FrozenPrefix
  catalog?: AssetCatalog
  makeEngine?: EngineFactory
  logger?: StepLogger
  runId?: string
  /** Injected clock for latency logging; defaults to a constant (keeps tests deterministic). */
  clock?: () => number
  /** Hard cap on model rounds — also bounds the repair loop. */
  maxRounds?: number
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
  const clock = deps.clock ?? (() => 0)
  const maxRounds = deps.maxRounds ?? 24
  const runId = deps.runId ?? 'run'
  const { tools } = buildToolRegistry()
  const ctx: ToolContext = { draft: newDraft(), catalog, makeEngine }
  const messages: ChatMessage[] = [{ role: 'user', content: prompt }]

  yield ev.plan(['select theme', 'set rules', 'author levels', 'validate', 'finalize'])

  let finalized: GameDefinition | undefined
  let stepIndex = 0

  for (let round = 0; round < maxRounds && !finalized; round++) {
    const startedAt = clock()
    const result = await client.chat(assembleRequest('pro', proPrefix, { messages }))

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
      break
    }

    for (const call of result.toolCalls) {
      const tool = tools.get(call.name)
      const res = tool ? tool.handler(call.arguments, ctx) : fail(`unknown tool ${call.name}`)
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
