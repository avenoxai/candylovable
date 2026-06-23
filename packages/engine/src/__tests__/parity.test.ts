import { describe, expect, it } from 'vitest'
import type { EngineEvent, GameDefinition } from '@candylovable/contract'
import { createFakeEngine, sampleMatch3 } from '@candylovable/mocks'
import { createEngine } from '../engine'

/**
 * BE-D5: the production Engine is a drop-in for the FE's FakeEngine — identical
 * EngineInstance behaviour AND identical EngineEvent emission order. We pin that
 * with a def that has NO special rules (`specials: []`), so both engines take the
 * clear-all path and stay byte-identical even after specials land in P2.
 */
const noSpecials: GameDefinition = {
  ...sampleMatch3,
  id: 'parity-no-specials',
  rules: { ...sampleMatch3.rules, specials: [] },
  // generous limits so the game runs many cascades before terminating
  levels: sampleMatch3.levels.map((l) => ({ ...l, moveLimit: 60, goal: { kind: 'score', target: 1_000_000 } })),
}

const recorder = () => {
  const events: EngineEvent[] = []
  return { events, sink: (e: EngineEvent) => events.push(e) }
}

describe('Engine ↔ FakeEngine parity', () => {
  it('produces an identical initial board for the same def', () => {
    const real = createEngine()
    const fake = createFakeEngine()
    const a = real.init(noSpecials, 0)
    const b = fake.init(noSpecials, 0)
    expect(a.cells.map((c) => c?.colorId ?? -1)).toEqual(b.cells.map((c) => c?.colorId ?? -1))
  })

  it('emits identical event traces over a lockstep sequence of moves', () => {
    const real = createEngine()
    const fake = createFakeEngine()
    real.init(noSpecials, 0)
    fake.init(noSpecials, 0)

    const rec = recorder()
    const recFake = recorder()
    real.onAny(rec.sink)
    fake.onAny(recFake.sink)

    for (let i = 0; i < 25 && real.getState().status === 'playing'; i++) {
      // boards are identical → the chosen move is valid on both
      const move = real.getHint()
      if (!move) break
      const r1 = real.trySwap(move.a, move.b)
      const r2 = fake.trySwap(move.a, move.b)
      expect(r1).toEqual(r2)
      // board stays in sync after every move
      expect(real.getState().cells.map((c) => c?.colorId ?? -1)).toEqual(
        fake.getState().cells.map((c) => c?.colorId ?? -1),
      )
    }

    expect(rec.events).toEqual(recFake.events)
    expect(real.getState().score).toBe(fake.getState().score)
    expect(real.getState().status).toBe(fake.getState().status)
    expect(real.getState().movesUsed).toBe(fake.getState().movesUsed)
    // sanity: the run actually exercised the cascade (not a no-op)
    expect(rec.events.length).toBeGreaterThan(10)
  })
})
