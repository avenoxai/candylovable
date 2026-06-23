import {
  type Cell,
  type Coord,
  type EngineEvent,
  type GameDefinition,
  toIndex,
} from '@candylovable/contract'
import { describe, expect, it } from 'vitest'
import { findMatches } from '../board'
import { FakeEngine, createFakeEngine } from '../fake-engine'
import { sampleMatch3 } from '../fixtures'

const recordEvents = (engine: FakeEngine): EngineEvent[] => {
  const evs: EngineEvent[] = []
  engine.onAny((e) => evs.push(e))
  return evs
}

/** Find an adjacent pair whose swap produces NO match (for the reject path). */
const findNoMatchPair = (engine: FakeEngine): { a: Coord; b: Coord } | null => {
  const { cells, width, height } = engine.getState()
  const swap = (i: number, j: number): void => {
    const t = cells[i] as Cell
    cells[i] = cells[j] as Cell
    cells[j] = t
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const steps: Coord[] = [
        { x: x + 1, y },
        { x, y: y + 1 },
      ]
      for (const n of steps) {
        if (n.x >= width || n.y >= height) continue
        const i = toIndex(x, y, width)
        const j = toIndex(n.x, n.y, width)
        swap(i, j)
        const matched = findMatches(cells, width, height, 3).length
        swap(i, j)
        if (matched === 0) return { a: { x, y }, b: n }
      }
    }
  }
  return null
}

const withLevel = (id: string, level: GameDefinition['levels'][number]): GameDefinition => ({
  ...sampleMatch3,
  id,
  levels: [level],
})

describe('FakeEngine.init', () => {
  it('starts a full, match-free, playing board', () => {
    const engine = createFakeEngine()
    const state = engine.init(sampleMatch3, 0)
    expect(state.cells).toHaveLength(64)
    expect(state.cells.every((c) => c !== null)).toBe(true)
    expect(findMatches(state.cells, state.width, state.height, 3)).toHaveLength(0)
    expect(state.status).toBe('playing')
    expect(state.score).toBe(0)
    expect(state.moveLimit).toBe(20)
  })

  it('is deterministic for the same def + level', () => {
    const a = createFakeEngine().init(sampleMatch3, 0)
    const b = createFakeEngine().init(sampleMatch3, 0)
    expect(a.cells.map((c) => c?.colorId)).toEqual(b.cells.map((c) => c?.colorId))
  })

  it('throws for a missing level', () => {
    expect(() => createFakeEngine().init(sampleMatch3, 99)).toThrow()
  })
})

describe('FakeEngine.trySwap rejection paths', () => {
  it('rejects a non-adjacent swap', () => {
    const engine = createFakeEngine()
    engine.init(sampleMatch3, 0)
    const r = engine.trySwap({ x: 0, y: 0 }, { x: 5, y: 5 })
    expect(r).toEqual({ accepted: false, reason: 'not-adjacent' })
  })

  it('rejects an out-of-bounds swap', () => {
    const engine = createFakeEngine()
    engine.init(sampleMatch3, 0)
    const r = engine.trySwap({ x: 0, y: 0 }, { x: -1, y: 0 })
    expect(r).toEqual({ accepted: false, reason: 'out-of-bounds' })
  })

  it('rejects a no-match swap and restores the board', () => {
    const engine = createFakeEngine()
    engine.init(sampleMatch3, 0)
    const before = engine.getState().cells.map((c) => c?.colorId)
    const pair = findNoMatchPair(engine)
    expect(pair).not.toBeNull()
    const evs = recordEvents(engine)
    const r = engine.trySwap(pair!.a, pair!.b)
    expect(r).toEqual({ accepted: false, reason: 'no-match' })
    expect(engine.getState().cells.map((c) => c?.colorId)).toEqual(before)
    expect(evs).toEqual([{ type: 'swap', a: pair!.a, b: pair!.b, accepted: false }])
    expect(engine.getState().movesUsed).toBe(0)
  })
})

describe('FakeEngine.trySwap accepted path', () => {
  it('resolves a cascade: emits swap→match→clear→score and scores points', () => {
    const engine = createFakeEngine()
    engine.init(sampleMatch3, 0)
    const move = engine.getAvailableMoves()[0]
    expect(move).toBeDefined()
    const evs = recordEvents(engine)
    const r = engine.trySwap(move!.a, move!.b)

    expect(r).toEqual({ accepted: true })
    expect(evs[0]).toEqual({ type: 'swap', a: move!.a, b: move!.b, accepted: true })
    expect(evs.some((e) => e.type === 'match')).toBe(true)
    expect(evs.some((e) => e.type === 'clear')).toBe(true)
    expect(evs.some((e) => e.type === 'score')).toBe(true)
    expect(engine.getState().score).toBeGreaterThan(0)
    expect(engine.getState().movesUsed).toBe(1)
    // board stays full after gravity + refill
    expect(engine.getState().cells.every((c) => c !== null)).toBe(true)
  })
})

describe('FakeEngine goal resolution', () => {
  it('emits win when the score goal is met', () => {
    const engine = createFakeEngine()
    engine.init(withLevel('win-test', { index: 0, goal: { kind: 'score', target: 1 }, moveLimit: 50, stars: [1, 2, 3] }), 0)
    const move = engine.getAvailableMoves()[0]!
    const evs = recordEvents(engine)
    engine.trySwap(move.a, move.b)
    const win = evs.find((e) => e.type === 'win')
    expect(win).toBeDefined()
    expect(engine.getState().status).toBe('won')
  })

  it('emits lose when moves run out short of the goal', () => {
    const engine = createFakeEngine()
    engine.init(withLevel('lose-test', { index: 0, goal: { kind: 'score', target: 1_000_000 }, moveLimit: 1 }), 0)
    const move = engine.getAvailableMoves()[0]!
    const evs = recordEvents(engine)
    engine.trySwap(move.a, move.b)
    expect(evs.some((e) => e.type === 'lose')).toBe(true)
    expect(engine.getState().status).toBe('lost')
  })

  it('refuses further swaps once the game has ended (busy)', () => {
    const engine = createFakeEngine()
    engine.init(withLevel('win-test', { index: 0, goal: { kind: 'score', target: 1 }, moveLimit: 50 }), 0)
    const move = engine.getAvailableMoves()[0]!
    engine.trySwap(move.a, move.b)
    const again = engine.getAvailableMoves()[0] ?? { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } }
    expect(engine.trySwap(again.a, again.b)).toEqual({ accepted: false, reason: 'busy' })
  })
})

describe('FakeEngine moves + reset', () => {
  it('reports available moves and a hint on a fresh board', () => {
    const engine = createFakeEngine()
    engine.init(sampleMatch3, 0)
    expect(engine.getAvailableMoves().length).toBeGreaterThan(0)
    expect(engine.getHint()).not.toBeNull()
  })

  it('reset restores a fresh playing state', () => {
    const engine = createFakeEngine()
    engine.init(sampleMatch3, 0)
    const move = engine.getAvailableMoves()[0]!
    engine.trySwap(move.a, move.b)
    expect(engine.getState().movesUsed).toBe(1)
    engine.reset()
    expect(engine.getState().movesUsed).toBe(0)
    expect(engine.getState().score).toBe(0)
    expect(engine.getState().status).toBe('playing')
  })

  it('on(type) only fires for that event type', () => {
    const engine = createFakeEngine()
    engine.init(sampleMatch3, 0)
    const swaps: EngineEvent[] = []
    engine.on('swap', (e) => swaps.push(e))
    const move = engine.getAvailableMoves()[0]!
    engine.trySwap(move.a, move.b)
    expect(swaps.length).toBe(1)
    expect(swaps[0]!.type).toBe('swap')
  })
})
