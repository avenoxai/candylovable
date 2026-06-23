import { describe, expect, it } from 'vitest'
import type { GameDefinition, LevelDef } from '@candylovable/contract'
import { sampleMatch3 } from '@candylovable/mocks'
import { analyzeGame, analyzeLevel } from '../analyze'

/** Clone sampleMatch3 with a single level overridden. */
const withLevel = (id: string, level: Partial<LevelDef>): GameDefinition => ({
  ...sampleMatch3,
  id,
  levels: [{ ...(sampleMatch3.levels[0] as LevelDef), index: 0, ...level }],
})

describe('analyzeLevel — winnable level', () => {
  const def = withLevel('analyze-winnable', {
    goal: { kind: 'score', target: 300 },
    moveLimit: 30,
  })

  it('reports an initial move, solvable, and a winning auto-play', () => {
    const a = analyzeLevel(def, 0)
    expect(a.hasInitialMove).toBe(true)
    expect(a.solvable).toBe(true)
    expect(a.autoPlay.won).toBe(true)
    expect(a.autoPlay.score).toBeGreaterThanOrEqual(300)
    expect(a.autoPlay.cascades).toBeGreaterThan(0)
  })

  it('suggests strictly monotonic stars with 1★ === the score target', () => {
    const a = analyzeLevel(def, 0)
    const [s1, s2, s3] = a.suggestedStars
    expect(s1).toBe(300)
    expect(s1).toBeLessThan(s2)
    expect(s2).toBeLessThan(s3)
  })

  it('reports difficulty within [0,1]', () => {
    const a = analyzeLevel(def, 0)
    expect(a.difficulty).toBeGreaterThanOrEqual(0)
    expect(a.difficulty).toBeLessThanOrEqual(1)
  })

  it('is deterministic: identical analysis across repeated runs', () => {
    expect(analyzeLevel(def, 0)).toEqual(analyzeLevel(def, 0))
  })
})

describe('analyzeLevel — unsolvable (greedy falls short)', () => {
  const def = withLevel('analyze-hard', {
    goal: { kind: 'score', target: 1_000_000_000 },
    moveLimit: 3,
  })

  it('flags not-solvable with an actionable note', () => {
    const a = analyzeLevel(def, 0)
    expect(a.solvable).toBe(false)
    expect(a.autoPlay.won).toBe(false)
    expect(a.notes.some((n) => n.includes('fell short'))).toBe(true)
    expect(a.difficulty).toBeGreaterThan(0.9)
  })
})

describe('analyzeLevel — gated goals + blockers', () => {
  it('rejects a clearJelly goal with a CONTRACT_VERSION 2 note (BE-D7/D8)', () => {
    const def = withLevel('analyze-jelly', { goal: { kind: 'clearJelly', target: 10 } })
    const a = analyzeLevel(def, 0)
    expect(a.solvable).toBe(false)
    expect(a.notes.some((n) => n.includes('unsupported-goal:clearJelly'))).toBe(true)
    // stars still strictly monotonic
    expect(a.suggestedStars[0]).toBeLessThan(a.suggestedStars[1])
    expect(a.suggestedStars[1]).toBeLessThan(a.suggestedStars[2])
  })

  it('rejects a bringDown goal too', () => {
    const def = withLevel('analyze-bring', { goal: { kind: 'bringDown', target: 5 } })
    expect(analyzeLevel(def, 0).notes.some((n) => n.includes('unsupported-goal:bringDown'))).toBe(true)
  })

  it('notes blockers are ignored (pending runtime support)', () => {
    const def = withLevel('analyze-blockers', {
      goal: { kind: 'score', target: 300 },
      moveLimit: 30,
      blockers: [{ at: { x: 0, y: 0 }, kind: 'jelly' }],
    })
    const a = analyzeLevel(def, 0)
    expect(a.notes.some((n) => n.includes('unsupported:blockers'))).toBe(true)
  })
})

describe('analyzeGame', () => {
  it('returns one analysis per level', () => {
    const out = analyzeGame(sampleMatch3)
    expect(out).toHaveLength(sampleMatch3.levels.length)
    for (const a of out) expect(a.suggestedStars[0]).toBeLessThan(a.suggestedStars[2])
  })
})
