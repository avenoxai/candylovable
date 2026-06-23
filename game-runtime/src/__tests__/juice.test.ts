import type { EngineEvent, JuiceConfig } from '@candylovable/contract'
import { describe, expect, it } from 'vitest'
import { type JuiceDirective, mapEvent, matchSignificance } from '../juice'

const FULL: JuiceConfig = {
  particles: 1,
  screenShake: 1,
  squashStretch: 1,
  cascadePitch: 1,
  reducedMotionFallback: true,
}
const full = { juice: FULL, reducedMotion: false }
const reduced = { juice: FULL, reducedMotion: true }

const find = <K extends JuiceDirective['kind']>(
  out: JuiceDirective[],
  kind: K,
): Extract<JuiceDirective, { kind: K }> | undefined =>
  out.find((d) => d.kind === kind) as Extract<JuiceDirective, { kind: K }> | undefined

describe('matchSignificance', () => {
  it('grows with match size (3 modest → 5 huge)', () => {
    expect(matchSignificance(3)).toBeLessThan(matchSignificance(4))
    expect(matchSignificance(4)).toBeLessThan(matchSignificance(5))
    expect(matchSignificance(7)).toBe(matchSignificance(5))
  })
})

describe('mapEvent — swap', () => {
  it('does not revert an accepted swap; reverts a rejected one (slower)', () => {
    const ok = mapEvent({ type: 'swap', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, accepted: true }, full)
    const no = mapEvent({ type: 'swap', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, accepted: false }, full)
    expect(find(ok, 'swap')!.revert).toBe(false)
    expect(find(no, 'swap')!.revert).toBe(true)
    expect(find(no, 'swap')!.duration).toBeGreaterThan(find(ok, 'swap')!.duration)
  })
})

describe('mapEvent — match (feedback scaled to significance)', () => {
  const match = (size: number): EngineEvent => ({
    type: 'match',
    cells: Array.from({ length: size }, (_, i) => ({ x: i, y: 0 })),
    shape: 'line',
    size,
  })

  it('a bigger match pops harder and throws more particles', () => {
    const small = mapEvent(match(3), full)
    const big = mapEvent(match(5), full)
    expect(find(big, 'pop')!.intensity).toBeGreaterThan(find(small, 'pop')!.intensity)
    expect(find(big, 'particles')!.count).toBeGreaterThan(find(small, 'particles')!.count)
  })

  it('reduced motion drops particles and shortens the pop', () => {
    const out = mapEvent(match(5), reduced)
    expect(find(out, 'particles')).toBeUndefined()
    expect(find(out, 'pop')!.duration).toBeLessThan(find(mapEvent(match(5), full), 'pop')!.duration)
  })

  it('juice.particles = 0 emits no particles', () => {
    const out = mapEvent(match(5), { juice: { ...FULL, particles: 0 }, reducedMotion: false })
    expect(find(out, 'particles')).toBeUndefined()
  })
})

describe('mapEvent — special detonation shake (only big, never under RM)', () => {
  const detonate = (n: number): EngineEvent => ({
    type: 'specialDetonate',
    origin: { x: 2, y: 2 },
    cleared: Array.from({ length: n }, (_, i) => ({ x: i, y: 2 })),
    kind: 'wrapped',
  })

  it('shakes for a big detonation but not a small one', () => {
    expect(find(mapEvent(detonate(8), full), 'shake')).toBeDefined()
    expect(find(mapEvent(detonate(3), full), 'shake')).toBeUndefined()
  })

  it('never shakes under reduced motion', () => {
    expect(find(mapEvent(detonate(8), reduced), 'shake')).toBeUndefined()
  })
})

describe('mapEvent — score / cascade / lifecycle', () => {
  it('scales the score popup with delta and clamps at 1', () => {
    expect(mapEvent({ type: 'score', delta: 60, total: 60, cascadeLevel: 1 }, full)).toEqual([
      { kind: 'scorePopup', delta: 60, intensity: 0.1 },
    ])
    const huge = mapEvent({ type: 'score', delta: 5000, total: 5000, cascadeLevel: 3 }, full)
    expect(find(huge, 'scorePopup')!.intensity).toBe(1)
  })

  it('maps clear → cascadePitch, gravity → fall, refill → dropIn', () => {
    expect(mapEvent({ type: 'clear', cells: [], cascadeLevel: 2 }, full)).toEqual([
      { kind: 'cascadePitch', level: 2 },
    ])
    const fall = mapEvent({ type: 'gravity', moves: [{ from: { x: 0, y: 0 }, to: { x: 0, y: 1 } }] }, full)
    expect(find(fall, 'fall')!.moves).toHaveLength(1)
    const drop = mapEvent(
      { type: 'refill', cells: [{ at: { x: 0, y: 0 }, tile: { colorId: 1, special: null, id: 9 } }] },
      full,
    )
    expect(find(drop, 'dropIn')!.cells).toEqual([{ x: 0, y: 0 }])
  })

  it('maps win/lose/near-miss/shuffle and ignores goalProgress', () => {
    expect(mapEvent({ type: 'win', stars: 3, score: 9000 }, full)).toEqual([{ kind: 'win', stars: 3 }])
    expect(mapEvent({ type: 'lose', reason: 'out-of-moves', shortBy: 1 }, full)).toEqual([
      { kind: 'lose', nearMiss: true },
    ])
    expect(mapEvent({ type: 'lose', reason: 'out-of-moves' }, full)).toEqual([
      { kind: 'lose', nearMiss: false },
    ])
    expect(mapEvent({ type: 'shuffle', reason: 'no-moves' }, full)).toEqual([{ kind: 'shuffle' }])
    expect(
      mapEvent({ type: 'goalProgress', goal: { kind: 'score', target: 100 }, current: 10, target: 100 }, full),
    ).toEqual([])
  })
})
