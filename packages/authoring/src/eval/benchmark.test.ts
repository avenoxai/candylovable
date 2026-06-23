import { describe, expect, it } from 'vitest'
import { checkSolvable, reference } from './load'

/**
 * P0 eval checkpoint: prove the quality bar is REAL before building anything that has to
 * hit it. The reference must be a well-formed candy match-3 whose every level starts from
 * a solvable board (run through the mocks engine). If this fails, the benchmark is wrong.
 */
describe('benchmark reference (P0 quality bar)', () => {
  it('is the candy match3 game with a 5-level curve', () => {
    expect(reference.meta.gameType).toBe('match3')
    expect(reference.theme.id).toBe('candy')
    expect(reference.levels).toHaveLength(5)
  })

  it('maps exactly the 6 engine colorIds (0..5)', () => {
    const ids = reference.board.cellTypes.map((c) => c.colorId).sort((a, b) => a - b)
    expect(ids).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('every level starts from a solvable board (mocks engine)', () => {
    const results = checkSolvable(reference)
    expect(results).toHaveLength(5)
    for (const r of results) {
      expect(r.solvableStart, `level ${r.levelIndex} had ${r.availableMoves} moves`).toBe(true)
    }
  })

  it('uses a varied, oscillating level design (not a flat score-only ramp)', () => {
    const kinds = new Set(reference.levels.map((l) => l.goal.kind))
    expect(kinds.size).toBeGreaterThanOrEqual(2)
  })
})
