import type { GameDefinition, GenerationEvent } from '@candylovable/contract'
import type { AssetCatalog } from '../assets/catalog'
import type { ChatMessage, DeepSeekClient, ModelTier, ToolCall } from '../llm/client'
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

const cleanLabel = (name: string): string => name.replaceAll('_', ' ')

const argString = (args: Record<string, unknown>, key: string): string | undefined =>
  typeof args[key] === 'string' ? args[key] : undefined

const argNumber = (args: Record<string, unknown>, key: string): number | undefined =>
  typeof args[key] === 'number' ? args[key] : undefined

const toolLabel = (call: ToolCall): string => {
  const args = call.arguments
  switch (call.name) {
    case 'select_theme':
      return `Choosing ${argString(args, 'theme') ?? 'the'} theme`
    case 'set_meta':
      return `Naming ${argString(args, 'title') ?? 'the game'}`
    case 'set_board': {
      const w = argNumber(args, 'width')
      const h = argNumber(args, 'height')
      return w && h ? `Building a ${w}×${h} board` : 'Building the board'
    }
    case 'set_rules':
      return 'Tuning match rules'
    case 'author_level': {
      const index = argNumber(args, 'index')
      return `Designing level ${index === undefined ? '' : index + 1}`.trim()
    }
    case 'set_juice':
      return 'Tuning game feel'
    case 'validate_game':
      return 'Validating the game'
    case 'finalize':
      return 'Finalizing the game'
    default:
      return cleanLabel(call.name)
  }
}

const toolNarration = (call: ToolCall): string => {
  const args = call.arguments
  switch (call.name) {
    case 'propose_design_directions':
      return "I’m sketching a few directions before committing to one.\n"
    case 'list_themes':
      return "I’m checking which visual themes are available.\n"
    case 'get_theme_assets':
      return `I’m checking the ${argString(args, 'theme') ?? 'selected'} asset set so the game uses real art.\n`
    case 'list_shared':
      return "I’m checking shared effects and blockers I can reuse.\n"
    case 'validate_asset_refs':
      return "I’m verifying that every asset reference exists in the library.\n"
    case 'select_theme':
      return `I’m choosing the ${argString(args, 'theme') ?? 'best'} theme and wiring its tile art.\n`
    case 'set_meta':
      return `I’m naming the game${argString(args, 'title') ? ` “${argString(args, 'title')}”` : ''}.\n`
    case 'set_board': {
      const w = argNumber(args, 'width')
      const h = argNumber(args, 'height')
      return w && h ? `I’m setting up a ${w}×${h} match-3 board.\n` : "I’m setting up the match-3 board.\n"
    }
    case 'set_rules':
      return "I’m tuning the match rules, scoring, and special-piece behavior.\n"
    case 'author_level': {
      const index = argNumber(args, 'index')
      const goal = typeof args.goal === 'object' && args.goal !== null ? (args.goal as Record<string, unknown>) : {}
      const kind = typeof goal.kind === 'string' ? goal.kind : 'goal'
      const target = typeof goal.target === 'number' ? ` target ${goal.target}` : ''
      const moves = argNumber(args, 'moveLimit')
      const moveText = moves === undefined ? '' : ` in ${moves} moves`
      return `I’m designing level ${index === undefined ? '' : index + 1}: ${kind}${target}${moveText}.\n`
    }
    case 'simulate_level': {
      const index = argNumber(args, 'index')
      return `I’m checking level ${index === undefined ? '' : index + 1} has a playable opening.\n`
    }
    case 'set_juice':
      return "I’m tuning particles, shake, and squash so clears feel satisfying.\n"
    case 'validate_game':
      return "I’m validating the draft before publishing it.\n"
    case 'request_asset':
      return "I’m requesting a missing asset instead of inventing one.\n"
    case 'finalize':
      return "I’m assembling the final playable game now.\n"
    default:
      return `I’m running ${cleanLabel(call.name)}.\n`
  }
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
  yield ev.token("I’ll build this with tools and narrate the key choices as I go.\n")

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

    if (result.content.trim()) yield ev.token(`${result.content.trim()}\n`)
    // Record the assistant's tool calls BEFORE their results (OpenAI/DeepSeek protocol).
    messages.push({ role: 'assistant', content: result.content, toolCalls: result.toolCalls })

    for (const call of result.toolCalls) {
      yield ev.token(toolNarration(call))
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
      yield ev.step(call.name, toolLabel(call), 'done', STEP_KIND[call.name] ?? 'design')
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
