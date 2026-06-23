/** Running DeepSeek spend, served by the backend at `GET /api/cost`. */
export interface CostSnapshot {
  /** Cumulative USD across all generations since the server started. */
  totalUSD: number
  generations: number
  /** Cost of the most recent generation. */
  lastUSD: number
}

/**
 * Fetch the running cost. Returns `null` when unavailable — in mock mode (no `/api/cost`
 * handler) or offline — so the badge simply hides instead of erroring.
 */
export async function fetchCost(): Promise<CostSnapshot | null> {
  try {
    const res = await fetch('/api/cost')
    if (!res.ok) return null
    return (await res.json()) as CostSnapshot
  } catch {
    return null
  }
}
