/**
 * Two motion vocabularies, never mixed (reports/frontend-plan.md §6):
 *  - UI (platform chrome): calm + snappy, low bounce.
 *  - GAME (juice, in the runtime): bouncier, exaggerated.
 * Durations are in seconds (Motion/Framer convention).
 */

export const UI_DURATION = {
  instant: 0.1,
  fast: 0.15,
  base: 0.2,
  slow: 0.28,
} as const

type Bezier = [number, number, number, number]

export const UI_EASE: Record<'standard' | 'decelerate' | 'accelerate', Bezier> = {
  standard: [0.2, 0, 0, 1],
  decelerate: [0.23, 1, 0.32, 1],
  accelerate: [0.4, 0, 1, 1],
}

/** Calm spring for UI (near-critically damped → bounce ≤ ~0.1). */
export const UI_SPRING = { type: 'spring', stiffness: 520, damping: 40 } as const

/** Playful spring for game juice (under-damped → visible bounce 0.2–0.4). */
export const GAME_SPRING = { type: 'spring', stiffness: 420, damping: 18 } as const

/** Stagger step for list/grid reveals (seconds per item). */
export const UI_STAGGER = 0.05

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Pick the reduced variant when the user asked for reduced motion. */
export const withReducedMotion = <T>(full: T, reduced: T): T =>
  prefersReducedMotion() ? reduced : full
