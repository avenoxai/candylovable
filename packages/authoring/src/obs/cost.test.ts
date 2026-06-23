import { describe, expect, it } from 'vitest'
import type { Usage } from '../llm/client'
import { costUSD } from './cost'

const usage = (over: Partial<Usage>): Usage => ({
  promptTokens: 0,
  cacheHitTokens: 0,
  cacheMissTokens: 0,
  completionTokens: 0,
  reasoningTokens: 0,
  ...over,
})

describe('costUSD', () => {
  it('prices pro cache-miss input + output per the rules.md §7 table', () => {
    const c = costUSD('pro', usage({ cacheMissTokens: 1_000_000, completionTokens: 1_000_000 }))
    expect(c).toBeCloseTo(0.435 + 0.87, 6)
  })

  it('a cache hit is >100× cheaper than a miss on pro (the frozen-prefix payoff)', () => {
    const hit = costUSD('pro', usage({ cacheHitTokens: 1_000_000 }))
    const miss = costUSD('pro', usage({ cacheMissTokens: 1_000_000 }))
    expect(miss / hit).toBeGreaterThan(100)
  })

  it('flash output is cheaper than pro output for the same tokens', () => {
    expect(costUSD('flash', usage({ completionTokens: 1_000_000 }))).toBeLessThan(
      costUSD('pro', usage({ completionTokens: 1_000_000 })),
    )
  })

  it('an empty usage costs nothing', () => {
    expect(costUSD('flash', usage({}))).toBe(0)
  })
})
