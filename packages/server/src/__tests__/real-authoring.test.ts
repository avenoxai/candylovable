import {
  FakeDeepSeek,
  type LibraryJson,
  type ScriptedTurn,
  type ToolCall,
  emptyUsage,
} from '@candylovable/authoring'
import type { GenerationEvent } from '@candylovable/contract'
import { analyzeLevel } from '@candylovable/engine'
import { describe, expect, it } from 'vitest'
import type { AuthoringDeps } from '../authoring'
import { RealAuthoring } from '../real-authoring'

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

const script = (): ScriptedTurn[] => [
  turn([
    tc('select_theme', { theme: 'candy' }),
    tc('set_meta', { title: 'Candy', gameType: 'match3' }),
    tc('set_board', { width: 8, height: 8 }),
    tc('set_rules', { minMatch: 3, specials: [{ match: 'line4', creates: 'striped-h' }], scoring: { baseClear: 60, specialCreateBonus: { 'striped-h': 120 } } }),
  ]),
  turn([
    tc('author_level', { index: 0, goal: { kind: 'score', target: 1500 }, moveLimit: 25, stars: [1500, 3000, 4500] }),
    tc('author_level', { index: 1, goal: { kind: 'collect', target: 20, collectColorId: 0 }, moveLimit: 26, stars: [3000, 5000, 7000] }),
    tc('simulate_level', { index: 0 }),
  ]),
  turn([tc('set_juice', { particles: 0.7 })]),
  turn([tc('finalize', {})]),
]

const deps = (): AuthoringDeps => ({ ids: () => 'id1', now: () => 0, rng: () => 0.5, analyzeLevel, library: candyLib() })

describe('RealAuthoring (server adapter)', () => {
  it('bridges generate() to a gameReady stream via an injected fake client + real Engine', async () => {
    const ra = new RealAuthoring({ apiKey: 'x', assetSkill: 'SKILL', library: candyLib(), client: new FakeDeepSeek(script()) })
    const events: GenerationEvent[] = []
    for await (const e of ra.generate({ prompt: 'make a candy game' }, deps())) events.push(e)
    expect(events.some((e) => e.type === 'gameReady')).toBe(true)
    expect(events.at(-1)?.type).toBe('done')
  })

  it('iterate fails gracefully while P4 is deferred', async () => {
    const ra = new RealAuthoring({ apiKey: 'x', assetSkill: 'S', library: candyLib(), client: new FakeDeepSeek([]) })
    const events: GenerationEvent[] = []
    for await (const e of ra.iterate({ sessionId: 's', message: 'm' }, { ...deps(), session: {} as never })) events.push(e)
    expect(events[0]?.type).toBe('error')
  })
})
