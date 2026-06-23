import { describe, expect, it } from 'vitest'
import { type LibraryJson } from './assets/catalog'
import { createPipeline } from './integration'
import type { ToolCall } from './llm/client'
import { emptyUsage } from './llm/client'
import { FakeDeepSeek, type ScriptedTurn } from './llm/fake'
import { generateToCompletion } from './orchestrator/generate'

const candyLib = (): LibraryJson => ({
  version: 1,
  tile_size: 256,
  kind: 'whole_sprite',
  themes: {
    candy: {
      background: { file: 'themes/candy/bg_candy.png', description: 'bg' },
      tiles: Array.from({ length: 6 }, (_u, i) => ({ colorId: i, file: `themes/candy/tile_candy_0${i}.png`, description: `t${i}` })),
    },
  },
  shared: { overlay: [], blocker: [], texture_9slice: [], particle: [] },
})

const tc = (name: string, args: Record<string, unknown>): ToolCall => ({ id: `c_${name}`, name, arguments: args })
const turn = (calls: ToolCall[]): ScriptedTurn => ({ result: { content: '', toolCalls: calls, usage: emptyUsage(), finishReason: 'tool_calls' } })

const buildScript = (): ScriptedTurn[] => [
  turn([
    tc('select_theme', { theme: 'candy' }),
    tc('set_meta', { title: 'T', gameType: 'match3' }),
    tc('set_board', { width: 8, height: 8 }),
    tc('set_rules', { minMatch: 3, specials: [{ match: 'line4', creates: 'striped-h' }], scoring: { baseClear: 60, specialCreateBonus: { 'striped-h': 120 } } }),
  ]),
  turn([
    tc('author_level', { index: 0, goal: { kind: 'score', target: 1500 }, moveLimit: 25, stars: [1500, 3000, 4500] }),
    tc('author_level', { index: 1, goal: { kind: 'collect', target: 20, collectColorId: 0 }, moveLimit: 26, stars: [3000, 5000, 7000] }),
  ]),
  turn([tc('set_juice', { particles: 0.7 })]),
  turn([tc('finalize', {})]),
]

describe('createPipeline', () => {
  it('constrains the goal kinds advertised in the frozen pro prefix', () => {
    const p = createPipeline({ apiKey: 'x', assetSkill: 'SKILL', library: candyLib(), goalKinds: ['score', 'collect'], client: new FakeDeepSeek([]) })
    expect(p.proPrefix.system).toContain('score, collect')
    expect(p.proPrefix.system).not.toContain('clearJelly')
    expect(p.catalog.hasTheme('candy')).toBe(true)
    expect(p.proPrefix.tools.length).toBeGreaterThan(10)
  })

  it('drives generate() to a gameReady with an injected fake client', async () => {
    const p = createPipeline({ apiKey: 'x', assetSkill: 'SKILL', library: candyLib(), goalKinds: ['score', 'collect'], client: new FakeDeepSeek(buildScript()) })
    const { def } = await generateToCompletion('make a candy game', { client: p.client, proPrefix: p.proPrefix, catalog: p.catalog })
    expect(def).toBeDefined()
    expect(def!.theme.id).toBe('candy')
  })

  it('stops immediately on an already-aborted signal', async () => {
    const p = createPipeline({ apiKey: 'x', assetSkill: 'S', library: candyLib(), client: new FakeDeepSeek(buildScript()) })
    const ac = new AbortController()
    ac.abort()
    const { def, events } = await generateToCompletion('x', { client: p.client, proPrefix: p.proPrefix, catalog: p.catalog, signal: ac.signal })
    expect(def).toBeUndefined()
    expect(events.some((e) => e.type === 'gameReady')).toBe(false)
  })
})
