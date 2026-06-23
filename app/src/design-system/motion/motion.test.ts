import { describe, expect, it, vi } from 'vitest'
import {
  GAME_SPRING,
  UI_DURATION,
  UI_EASE,
  UI_SPRING,
  prefersReducedMotion,
  withReducedMotion,
} from './motion'

const mockMatchMedia = (matches: boolean): void => {
  window.matchMedia = vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia
}

describe('UI motion vocabulary', () => {
  it('durations are positive and strictly ascending', () => {
    const d = [UI_DURATION.instant, UI_DURATION.fast, UI_DURATION.base, UI_DURATION.slow]
    expect(d.every((x) => x > 0)).toBe(true)
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThan(d[i - 1] as number)
  })

  it('easings are cubic-bezier 4-tuples', () => {
    for (const e of Object.values(UI_EASE)) expect(e).toHaveLength(4)
  })

  it('UI spring is calmer (less bouncy) than the game spring', () => {
    const dampingRatio = (s: { stiffness: number; damping: number }): number =>
      s.damping / (2 * Math.sqrt(s.stiffness))
    expect(dampingRatio(UI_SPRING)).toBeGreaterThan(dampingRatio(GAME_SPRING))
  })
})

describe('reduced motion', () => {
  it('prefersReducedMotion reflects the media query', () => {
    mockMatchMedia(true)
    expect(prefersReducedMotion()).toBe(true)
    mockMatchMedia(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('withReducedMotion swaps to the reduced variant only when requested', () => {
    mockMatchMedia(true)
    expect(withReducedMotion('full', 'reduced')).toBe('reduced')
    mockMatchMedia(false)
    expect(withReducedMotion('full', 'reduced')).toBe('full')
  })
})
