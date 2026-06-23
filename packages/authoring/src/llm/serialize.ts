/**
 * Deterministic JSON: object keys sorted recursively, so two equal objects built in a
 * different key order serialize to identical bytes. Used to make tool schemas byte-stable
 * inside the frozen cache prefix (rules.md §7) — a reserialized-but-equivalent tool block
 * would otherwise miss the cache.
 */
export function canonicalJSON(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort()) {
      out[key] = sortKeys(source[key])
    }
    return out
  }
  return value
}
