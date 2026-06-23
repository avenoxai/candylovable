import type { ModelTier, Usage } from '../llm/client'

/** USD per 1M tokens. Current (permanent) DeepSeek v4 pricing — see rules.md §7 / the caching playbook. */
interface TierPrice {
  cacheHit: number
  cacheMiss: number
  output: number
}

const PRICES: Record<ModelTier, TierPrice> = {
  flash: { cacheHit: 0.0028, cacheMiss: 0.14, output: 0.28 },
  pro: { cacheHit: 0.003625, cacheMiss: 0.435, output: 0.87 },
}

const PER = 1_000_000

/**
 * Cost of one model call in USD. Reasoning tokens bill as output, so they must already be
 * folded into `completionTokens` by the client. Cache-hit input is ~50× (flash) / ~120×
 * (pro) cheaper than a miss — which is the whole point of the frozen-prefix invariant.
 */
export function costUSD(model: ModelTier, u: Usage): number {
  const p = PRICES[model]
  return (u.cacheHitTokens * p.cacheHit + u.cacheMissTokens * p.cacheMiss + u.completionTokens * p.output) / PER
}

export function priceOf(model: ModelTier): Readonly<TierPrice> {
  return PRICES[model]
}
