import type { Scene } from '@candylovable/game-runtime'
import { FakeEngine, sampleMatch3 } from '@candylovable/mocks'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useMatch3Session } from './useMatch3Session'

/** No-op Scene so the hook runs in jsdom without Pixi. */
class NoopScene implements Scene {
  resize(): void {}
  addTile(): void {}
  moveTile(): void {}
  swapTiles(): void {}
  popTiles(): void {}
  setSpecial(): void {}
  burst(): void {}
  shake(): void {}
  scorePopup(): void {}
  banner(): void {}
  reset(): void {}
  destroy(): void {}
}

/** The hook's engine is deterministic for a def — derive a real move the same way. */
const firstMove = () => {
  const e = new FakeEngine()
  e.init(sampleMatch3, 0)
  return e.getAvailableMoves()[0]!
}

describe('useMatch3Session', () => {
  it('exposes the level HUD once a scene is attached', () => {
    const scene = new NoopScene()
    const { result } = renderHook(() =>
      useMatch3Session(sampleMatch3, scene, { reducedMotion: true }),
    )
    expect(result.current.ready).toBe(true)
    expect(result.current.hud.status).toBe('playing')
    expect(result.current.hud.score).toBe(0)
    expect(result.current.hud.movesLeft).toBe(20)
    expect(result.current.hud.goalTarget).toBe(2000)
  })

  it('a tap-tap across an available move scores and consumes a move', () => {
    const move = firstMove()
    const scene = new NoopScene()
    const { result } = renderHook(() =>
      useMatch3Session(sampleMatch3, scene, { reducedMotion: true }),
    )
    act(() => result.current.onCellPick(move.a))
    expect(result.current.selected).toEqual(move.a)
    act(() => result.current.onCellPick(move.b))
    expect(result.current.hud.score).toBeGreaterThan(0)
    expect(result.current.hud.movesUsed).toBe(1)
    expect(result.current.selected).toBeNull()
  })

  it('tapping the same cell twice clears the selection', () => {
    const scene = new NoopScene()
    const { result } = renderHook(() =>
      useMatch3Session(sampleMatch3, scene, { reducedMotion: true }),
    )
    act(() => result.current.onCellPick({ x: 0, y: 0 }))
    expect(result.current.selected).toEqual({ x: 0, y: 0 })
    act(() => result.current.onCellPick({ x: 0, y: 0 }))
    expect(result.current.selected).toBeNull()
  })

  it('reset returns to a fresh playing state', () => {
    const move = firstMove()
    const scene = new NoopScene()
    const { result } = renderHook(() =>
      useMatch3Session(sampleMatch3, scene, { reducedMotion: true }),
    )
    act(() => result.current.onCellPick(move.a))
    act(() => result.current.onCellPick(move.b))
    expect(result.current.hud.movesUsed).toBe(1)
    act(() => result.current.reset())
    expect(result.current.hud.movesUsed).toBe(0)
    expect(result.current.hud.score).toBe(0)
  })

  it('does nothing before a scene is attached (ready=false)', () => {
    const { result } = renderHook(() => useMatch3Session(sampleMatch3, null, { reducedMotion: true }))
    expect(result.current.ready).toBe(false)
    act(() => result.current.onCellPick({ x: 0, y: 0 }))
    expect(result.current.selected).toBeNull() // no engine yet
  })
})
