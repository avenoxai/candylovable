/** Tiny tween engine. Frame-agnostic: the renderer drives it via update(dtMs),
 *  which keeps the easing/interpolation math unit-testable without a render loop. */

export type Ease = (t: number) => number

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const easeOutCubic: Ease = (t) => 1 - (1 - t) ** 3

/** Overshoots then settles — the UI "decelerate" / gentle bounce feel. */
export const easeOutBack: Ease = (t) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

interface Tween {
  obj: Record<string, number>
  from: Record<string, number>
  to: Record<string, number>
  elapsed: number
  duration: number
  ease: Ease
  onComplete?: () => void
}

export class Tweener {
  private tweens: Tween[] = []

  /** Animate numeric props of `obj` to `to` over `durationMs`. */
  to(
    obj: Record<string, number>,
    to: Record<string, number>,
    durationMs: number,
    ease: Ease = easeOutCubic,
    onComplete?: () => void,
  ): void {
    const keys = Object.keys(to)
    this.cancel(obj, keys)
    if (durationMs <= 0) {
      Object.assign(obj, to)
      onComplete?.()
      return
    }
    const from: Record<string, number> = {}
    for (const k of keys) from[k] = obj[k] ?? 0
    this.tweens.push({ obj, from, to, elapsed: 0, duration: durationMs, ease, onComplete })
  }

  /** Remove queued tweens for `obj` without firing completion callbacks. */
  cancel(obj: Record<string, number>, keys?: readonly string[]): void {
    const keySet = keys ? new Set(keys) : null
    this.tweens = this.tweens.filter(
      (tw) => tw.obj !== obj || (keySet !== null && !Object.keys(tw.to).some((k) => keySet.has(k))),
    )
  }

  update(dtMs: number): void {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i]
      if (!tw) continue
      tw.elapsed += dtMs
      const t = Math.min(1, tw.elapsed / tw.duration)
      const e = tw.ease(t)
      for (const k of Object.keys(tw.to)) tw.obj[k] = lerp(tw.from[k] ?? 0, tw.to[k] ?? 0, e)
      if (t >= 1) {
        this.tweens.splice(i, 1)
        tw.onComplete?.()
      }
    }
  }

  get active(): number {
    return this.tweens.length
  }

  clear(): void {
    this.tweens = []
  }
}
