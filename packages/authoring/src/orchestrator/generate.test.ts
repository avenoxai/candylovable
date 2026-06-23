import { describe, expect, it } from 'vitest'
import { AssetCatalog, type LibraryJson } from '../assets/catalog'
import { scoreGame } from '../eval/bench'
import type { ChatResult, ToolCall } from '../llm/client'
import { emptyUsage } from '../llm/client'
import { FakeDeepSeek, type ScriptedTurn } from '../llm/fake'
import { MemoryStepLogger } from '../obs/logger'
import type { FrozenPrefix } from '../prompts/assemble'
import { buildToolRegistry } from '../tools/tools'
import { generate, generateToCompletion } from './generate'

function candyCatalog(): AssetCatalog {
  const tiles = Array.from({ length: 6 }, (_unused, i) => ({
    colorId: i,
    file: `themes/candy/tile_candy_0${i}.png`,
    description: `candy tile ${i}`,
  }))
  const lib: LibraryJson = {
    version: 1,
    tile_size: 256,
    kind: 'whole_sprite',
    themes: { candy: { background: { file: 'themes/candy/bg_candy.png', description: 'bg' }, tiles } },
    shared: { overlay: [], blocker: [], texture_9slice: [], particle: [] },
  }
  return new AssetCatalog(lib)
}

const tc = (name: string, args: Record<string, unknown>): ToolCall => ({ id: `c_${name}_${args.index ?? ''}`, name, arguments: args })
const turn = (toolCalls: ToolCall[]): ScriptedTurn => ({ result: { content: '', toolCalls, usage: emptyUsage(), finishReason: 'tool_calls' } as ChatResult })

const jelly = (): Record<string, unknown>[] => {
  const out: Record<string, unknown>[] = []
  for (let y = 3; y <= 5; y++) for (let x = 2; x <= 5; x++) out.push({ at: { x, y }, kind: 'jelly', layers: 1 })
  return out
}

/** A scripted run mirroring benchmark/ideal-trace.md — drives a reference-grade game. */
function idealScript(): ScriptedTurn[] {
  return [
    turn([
      tc('select_theme', { theme: 'candy' }),
      tc('set_meta', { title: 'Candy Cascade', gameType: 'match3' }),
      tc('set_board', { width: 8, height: 8 }),
      tc('set_rules', {
        minMatch: 3,
        allowDiagonal: false,
        specials: [
          { match: 'line4', creates: 'striped-h' },
          { match: 'line5', creates: 'colorBomb' },
          { match: 'tShape', creates: 'wrapped' },
        ],
        scoring: { baseClear: 60, cascadeMultiplier: 'linear', specialCreateBonus: { 'striped-h': 120, wrapped: 200, colorBomb: 300 } },
      }),
    ]),
    turn([
      tc('author_level', { index: 0, goal: { kind: 'score', target: 1500 }, moveLimit: 25, stars: [1500, 3000, 4500] }),
      tc('author_level', { index: 1, goal: { kind: 'score', target: 3500 }, moveLimit: 22, stars: [3500, 5500, 8000] }),
      tc('author_level', { index: 2, goal: { kind: 'clearJelly', target: 12 }, moveLimit: 20, blockers: jelly(), stars: [4000, 6500, 9000] }),
      tc('author_level', { index: 3, goal: { kind: 'collect', target: 20, collectColorId: 0 }, moveLimit: 26, stars: [3000, 5000, 7000] }),
      tc('author_level', { index: 4, goal: { kind: 'score', target: 7000 }, moveLimit: 20, stars: [7000, 10500, 14000] }),
    ]),
    turn([tc('set_juice', { particles: 0.7, screenShake: 0.25, squashStretch: 0.6, cascadePitch: 0.85 })]),
    turn([tc('finalize', {})]),
  ]
}

const prefix = (): FrozenPrefix => ({ system: 'test-pro', tools: buildToolRegistry().defs })

describe('generate (scripted bench — the P3 eval checkpoint)', () => {
  it('replays the ideal trace into a benchmark-grade gameReady (score >= 80)', async () => {
    const logger = new MemoryStepLogger()
    const { events, def } = await generateToCompletion('make a candy match-3, juicy', {
      client: new FakeDeepSeek(idealScript()),
      proPrefix: prefix(),
      catalog: candyCatalog(),
      logger,
    })

    expect(def).toBeDefined()
    expect(events[0]!.type).toBe('plan')
    expect(events.at(-1)!.type).toBe('done')
    expect(events.some((e) => e.type === 'gameReady')).toBe(true)

    const card = scoreGame(def!, { catalog: candyCatalog() })
    expect(card.score).toBeGreaterThanOrEqual(80)
    expect(card.dimensions.find((d) => d.name === 'valid+solvable')!.score).toBe(25)

    // observability: one logged step per model round, all priced
    expect(logger.records()).toHaveLength(4)
    expect(logger.records().every((r) => r.model === 'pro')).toBe(true)
  })

  it('emits a recoverable=false error when the model never produces a valid game', async () => {
    const events = []
    for await (const e of generate('x', {
      client: new FakeDeepSeek([turn([])]), // model says nothing actionable
      proPrefix: prefix(),
      catalog: candyCatalog(),
    })) {
      events.push(e)
    }
    expect(events.at(-1)!.type).toBe('error')
  })
})
