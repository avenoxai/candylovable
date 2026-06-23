import { describe, expect, it } from 'vitest'
import type { EngineEvent, GameDefinition } from '@candylovable/contract'
import { findMatches } from '../board'
import { Engine, createEngine } from '../engine'

// A 5x3 def with a hand-authored board that has NO pre-existing match, but where
// swapping (2,0)<->(2,1) creates exactly one horizontal 3-match of colour 1 on row 0.
const swapToMatch = (over: {
  id?: string
  target?: number
  moveLimit?: number
  goalKind?: 'score' | 'collect'
  collectColorId?: number
}): GameDefinition => ({
  schemaVersion: 1,
  id: over.id ?? 'test-swap-match',
  meta: { title: 'T', gameType: 'match3' },
  board: {
    width: 5,
    height: 3,
    cellTypes: Array.from({ length: 6 }, (_, i) => ({ colorId: i })),
  },
  rules: {
    minMatch: 3,
    allowDiagonal: false,
    specials: [],
    scoring: { baseClear: 60, cascadeMultiplier: 'linear', specialCreateBonus: {} },
  },
  levels: [
    {
      index: 0,
      goal:
        over.goalKind === 'collect'
          ? { kind: 'collect', target: over.target ?? 3, collectColorId: over.collectColorId ?? 1 }
          : { kind: 'score', target: over.target ?? 100 },
      moveLimit: over.moveLimit,
      stars: [100, 200, 300],
      // row0: 1,1,2,3,4  row1: 5,0,1,5,0  row2: 2,3,4,0,1  (no initial match)
      boardOverride: [1, 1, 2, 3, 4, 5, 0, 1, 5, 0, 2, 3, 4, 0, 1],
    },
  ],
  theme: { id: 'x', displayName: 'X', assetBaseUrl: '/assets', background: '', palette: [], tiles: [] },
  audio: { pack: 'default', cues: {} },
  juice: {
    particles: 0.5,
    screenShake: 0.5,
    squashStretch: 0.5,
    cascadePitch: 0.5,
    reducedMotionFallback: true,
  },
})

const trace = (e: Engine): { events: EngineEvent[]; unsub: () => void } => {
  const events: EngineEvent[] = []
  const unsub = e.onAny((ev) => events.push(ev))
  return { events, unsub }
}

describe('Engine — swap validation', () => {
  it('rejects a non-adjacent swap', () => {
    const e = createEngine()
    e.init(swapToMatch({}), 0)
    expect(e.trySwap({ x: 0, y: 0 }, { x: 2, y: 0 })).toEqual({
      accepted: false,
      reason: 'not-adjacent',
    })
  })

  it('rejects an out-of-bounds swap', () => {
    const e = createEngine()
    e.init(swapToMatch({}), 0)
    expect(e.trySwap({ x: 0, y: 0 }, { x: -1, y: 0 }).accepted).toBe(false)
  })

  it('rejects a swap that makes no match and restores the board + emits swap(false)', () => {
    const e = createEngine()
    e.init(swapToMatch({}), 0)
    const before = e.getState().cells.map((c) => c?.colorId ?? -1)
    const { events } = trace(e)
    const res = e.trySwap({ x: 0, y: 0 }, { x: 1, y: 0 }) // 1<->1, no new match
    expect(res).toEqual({ accepted: false, reason: 'no-match' })
    expect(events).toEqual([{ type: 'swap', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, accepted: false }])
    expect(e.getState().cells.map((c) => c?.colorId ?? -1)).toEqual(before)
  })
})

describe('Engine — cascade + scoring', () => {
  it('accepts a 3-match swap: emits swap→match→clear→score, first delta = 3*60', () => {
    const e = createEngine()
    e.init(swapToMatch({}), 0)
    const { events } = trace(e)
    const res = e.trySwap({ x: 2, y: 0 }, { x: 2, y: 1 })
    expect(res).toEqual({ accepted: true })
    expect(events[0]).toEqual({ type: 'swap', a: { x: 2, y: 0 }, b: { x: 2, y: 1 }, accepted: true })

    const firstMatch = events.find((ev) => ev.type === 'match')
    expect(firstMatch).toMatchObject({ type: 'match', size: 3, shape: 'line' })

    const firstScore = events.find((ev) => ev.type === 'score')
    expect(firstScore).toMatchObject({ type: 'score', delta: 180, cascadeLevel: 1 })

    expect(e.getState().movesUsed).toBe(1)
    expect(e.getState().score).toBeGreaterThanOrEqual(180)
  })

  it('is fully deterministic: same def + same move → identical event trace', () => {
    const run = (): EngineEvent[] => {
      const e = createEngine()
      e.init(swapToMatch({ id: 'determinism' }), 0)
      const { events } = trace(e)
      e.trySwap({ x: 2, y: 0 }, { x: 2, y: 1 })
      return events
    }
    expect(run()).toEqual(run())
  })
})

describe('Engine — goals + termination', () => {
  it('wins when the score goal is met (tiny target)', () => {
    const e = createEngine()
    e.init(swapToMatch({ target: 100 }), 0)
    const { events } = trace(e)
    e.trySwap({ x: 2, y: 0 }, { x: 2, y: 1 })
    expect(e.getState().status).toBe('won')
    const win = events.find((ev) => ev.type === 'win')
    expect(win).toBeDefined()
    if (win && win.type === 'win') {
      expect(win.stars).toBeGreaterThanOrEqual(1)
      expect(win.stars).toBeLessThanOrEqual(3)
    }
  })

  it('loses (out-of-moves, no near-miss) with an unreachable target and moveLimit 1', () => {
    const e = createEngine()
    e.init(swapToMatch({ target: 1_000_000_000, moveLimit: 1 }), 0)
    const { events } = trace(e)
    e.trySwap({ x: 2, y: 0 }, { x: 2, y: 1 })
    expect(e.getState().status).toBe('lost')
    const lose = events.find((ev) => ev.type === 'lose')
    expect(lose).toEqual({ type: 'lose', reason: 'out-of-moves' })
    expect(events.find((ev) => ev.type === 'nearMiss')).toBeUndefined()
  })

  it('refuses to move after the game has ended (busy)', () => {
    const e = createEngine()
    e.init(swapToMatch({ target: 100 }), 0)
    e.trySwap({ x: 2, y: 0 }, { x: 2, y: 1 }) // wins
    expect(e.trySwap({ x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ accepted: false, reason: 'busy' })
  })

  it('tracks a collect goal — the first 3-match contributes 3 of the collected colour', () => {
    const e = createEngine()
    e.init(swapToMatch({ goalKind: 'collect', collectColorId: 1, target: 999 }), 0)
    e.trySwap({ x: 2, y: 0 }, { x: 2, y: 1 }) // clears three colour-1 tiles
    expect(e.getState().goalProgress).toBeGreaterThanOrEqual(3)
  })
})

describe('Engine — lifecycle', () => {
  it('settles a hand-authored board with no leftover matches and no events', () => {
    const def = swapToMatch({})
    // inject a pre-existing horizontal 3-match into the override
    def.levels[0]!.boardOverride = [2, 2, 2, 3, 4, 5, 0, 1, 5, 0, 1, 3, 4, 0, 1]
    const e = createEngine()
    const { events } = trace(e)
    const state = e.init(def, 0)
    expect(events).toHaveLength(0) // init never emits
    // settleSilently cleared the pre-existing match → board is stable
    expect(findMatches(state.cells, state.width, state.height, 3)).toHaveLength(0)
  })

  it('reset restores a fresh, identical initial board', () => {
    const e = createEngine()
    const init = e.init(swapToMatch({ id: 'reset-test' }), 0)
    const initialColors = init.cells.map((c) => c?.colorId ?? -1)
    e.trySwap({ x: 2, y: 0 }, { x: 2, y: 1 })
    e.reset()
    const after = e.getState()
    expect(after.score).toBe(0)
    expect(after.movesUsed).toBe(0)
    expect(after.status).toBe('playing')
    expect(after.cells.map((c) => c?.colorId ?? -1)).toEqual(initialColors)
  })

  it('throws on a missing level index', () => {
    const e = createEngine()
    expect(() => e.init(swapToMatch({}), 5)).toThrow()
  })
})

describe('Engine — full auto-play integration', () => {
  it('a greedy bot terminates with monotonic score and never throws', () => {
    const e = createEngine()
    e.init(swapToMatch({ id: 'autoplay', target: 5000, moveLimit: 30 }), 0)
    let lastScore = 0
    let guard = 0
    while (e.getState().status === 'playing' && guard++ < 200) {
      const move = e.getHint()
      if (!move) break
      e.trySwap(move.a, move.b)
      expect(e.getState().score).toBeGreaterThanOrEqual(lastScore)
      lastScore = e.getState().score
    }
    expect(['won', 'lost', 'playing']).toContain(e.getState().status)
    expect(guard).toBeLessThan(200) // did not spin forever
  })
})
