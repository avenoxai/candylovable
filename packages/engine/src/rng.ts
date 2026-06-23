/**
 * Deterministic PRNG + tile-id factory. The engine owns its own copy (no
 * dependency on `@candylovable/mocks`, which is the FE's dev/test harness) so
 * the production core is self-contained and reproducible per (gameId, level).
 */

export type Rng = () => number

/** Small, fast, seedable PRNG (mulberry32). Same seed → same stream. */
export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform integer in `[0, n)`. */
export const randInt = (rng: Rng, n: number): number => Math.floor(rng() * n)

/** Monotonic tile-id source so the renderer can track a tile across gravity/refill. */
export const makeIdFactory = (start = 1): (() => number) => {
  let n = start
  return () => n++
}

/** FNV-1a hash → stable 32-bit seed from a game id string. */
export const hashString = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
