import { describe, expect, it, vi } from 'vitest'
import { Tweener, easeOutBack, easeOutCubic, lerp } from '../tween'

describe('easings', () => {
  it('easeOutCubic spans 0→1 and is monotonic', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5) // fast out
  })

  it('easeOutBack overshoots past 1 before settling exactly at 1', () => {
    expect(easeOutBack(1)).toBeCloseTo(1, 5)
    const peak = Math.max(...[0.6, 0.7, 0.8, 0.9].map(easeOutBack))
    expect(peak).toBeGreaterThan(1) // the bounce
  })

  it('lerp interpolates', () => {
    expect(lerp(0, 10, 0.5)).toBe(5)
  })
})

describe('Tweener', () => {
  it('reaches the target and fires onComplete once after the duration', () => {
    const tw = new Tweener()
    const obj = { x: 0 }
    const done = vi.fn()
    tw.to(obj, { x: 100 }, 100, easeOutCubic, done)
    expect(tw.active).toBe(1)
    tw.update(50)
    expect(obj.x).toBeGreaterThan(0)
    expect(obj.x).toBeLessThan(100)
    tw.update(60) // past the end
    expect(obj.x).toBe(100)
    expect(done).toHaveBeenCalledTimes(1)
    expect(tw.active).toBe(0)
  })

  it('applies instantly (and completes) for non-positive durations', () => {
    const tw = new Tweener()
    const obj = { a: 1 }
    const done = vi.fn()
    tw.to(obj, { a: 9 }, 0, easeOutCubic, done)
    expect(obj.a).toBe(9)
    expect(done).toHaveBeenCalledTimes(1)
    expect(tw.active).toBe(0)
  })

  it('tweens multiple props together and clears', () => {
    const tw = new Tweener()
    const obj = { x: 0, y: 0 }
    tw.to(obj, { x: 10, y: 20 }, 10)
    tw.update(10)
    expect(obj).toEqual({ x: 10, y: 20 })
    tw.to(obj, { x: 0 }, 100)
    tw.clear()
    expect(tw.active).toBe(0)
  })

  it('cancels queued tweens for a target without completing them', () => {
    const tw = new Tweener()
    const obj = { x: 0 }
    const done = vi.fn()
    tw.to(obj, { x: 10 }, 100, easeOutCubic, done)
    tw.cancel(obj)
    tw.update(100)
    expect(obj.x).toBe(0)
    expect(done).not.toHaveBeenCalled()
    expect(tw.active).toBe(0)
  })

  it('lets the latest tween for a property win when cascades retarget a sprite before a frame', () => {
    const tw = new Tweener()
    const obj = { x: 0, y: 0 }
    const staleDone = vi.fn()
    const latestDone = vi.fn()
    tw.to(obj, { x: 10, y: 10 }, 100, easeOutCubic, staleDone)
    tw.to(obj, { x: 20, y: 20 }, 100, easeOutCubic, latestDone)
    tw.update(100)
    expect(obj).toEqual({ x: 20, y: 20 })
    expect(staleDone).not.toHaveBeenCalled()
    expect(latestDone).toHaveBeenCalledTimes(1)
    expect(tw.active).toBe(0)
  })
})
