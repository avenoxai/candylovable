import { useEffect, useState } from 'react'
import { Badge } from '../../design-system/primitives'
import { type CostSnapshot, fetchCost } from '../../lib/api/cost'

/**
 * Calm chrome badge showing cumulative DeepSeek spend. Refetches whenever `refreshKey`
 * changes (the workspace bumps it after each finished generation). `load` is injectable so
 * tests stay deterministic; it returns null in mock mode, where the badge renders nothing.
 */
export const CostBadge = ({
  refreshKey = 0,
  load = fetchCost,
}: {
  refreshKey?: number
  load?: () => Promise<CostSnapshot | null>
}) => {
  const [cost, setCost] = useState<CostSnapshot | null>(null)

  useEffect(() => {
    let live = true
    void load().then((next) => {
      if (live) setCost(next)
    })
    return () => {
      live = false
    }
  }, [load, refreshKey])

  if (!cost) return null
  return (
    <Badge tone="neutral" title={`${cost.generations} generations · last $${cost.lastUSD.toFixed(4)}`}>
      ≈ ${cost.totalUSD.toFixed(4)}
    </Badge>
  )
}
