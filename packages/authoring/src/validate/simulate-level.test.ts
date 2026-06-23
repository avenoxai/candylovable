import type { EngineInstance } from '@candylovable/contract'
import { describe, expect, it } from 'vitest'
import { reference } from '../eval/load'
import { simulateAll, simulateLevel } from './simulate-level'

describe('simulateLevel', () => {
  it('reports every benchmark level as solvable at start (mocks engine)', () => {
    const sims = simulateAll(reference)
    expect(sims).toHaveLength(5)
    for (const s of sims) {
      expect(s.solvableStart, `level ${s.levelIndex}`).toBe(true)
    }
  })

  it('reports a dead board (no moves) as unsolvable via an injected engine', () => {
    const deadEngine = {
      init() {},
      getAvailableMoves: () => [],
    } as unknown as EngineInstance
    const sim = simulateLevel(reference, 0, () => deadEngine)
    expect(sim.solvableStart).toBe(false)
    expect(sim.availableMoves).toBe(0)
  })
})
