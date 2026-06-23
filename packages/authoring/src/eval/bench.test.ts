import type { GameDefinition } from '@candylovable/contract'
import { describe, expect, it } from 'vitest'
import { scoreGame } from './bench'
import { reference } from './load'

describe('scoreGame (benchmark rubric)', () => {
  it('scores the echo reference at the top of the range with a green gate', () => {
    const card = scoreGame(reference)
    expect(card.score).toBeGreaterThanOrEqual(90)
    const gate = card.dimensions.find((d) => d.name === 'valid+solvable')!
    expect(gate.score).toBe(gate.max)
  })

  it('scores a flat, samey game well below the reference (and under the 80 bar)', () => {
    const flat = structuredClone(reference) as GameDefinition
    flat.levels = flat.levels.map((_l, i) => ({
      index: i,
      goal: { kind: 'score' as const, target: 1000 * (i + 1) },
      moveLimit: 20,
      stars: [1000 * (i + 1), 2000 * (i + 1), 3000 * (i + 1)] as [number, number, number],
    }))
    flat.rules.specials = []
    flat.rules.scoring.specialCreateBonus = {}

    const flatScore = scoreGame(flat).score
    expect(flatScore).toBeLessThan(scoreGame(reference).score)
    expect(flatScore).toBeLessThan(80)
  })

  it('rubric maxes sum to 100', () => {
    expect(scoreGame(reference).dimensions.reduce((s, d) => s + d.max, 0)).toBe(100)
  })
})
