import type { EngineEvent } from '@candylovable/contract'
import { FakeEngine, sampleMatch3 } from '@candylovable/mocks'
import { describe, expect, it } from 'vitest'
import { BoardController } from '../board-controller'
import type { Scene, TileView } from '../scene'

/** Records every Scene call so we can assert the controller's orchestration. */
class FakeScene implements Scene {
  resizes: Array<[number, number]> = []
  added: TileView[] = []
  dropIns = 0
  moves: Array<{ id: number; bounce: boolean }> = []
  swaps: Array<{ idA: number; idB: number; revert: boolean }> = []
  popped: number[] = []
  bursts = 0
  specials: Array<{ id: number; special: string }> = []
  shakes = 0
  scorePops = 0
  banners: string[] = []

  resize(w: number, h: number): void {
    this.resizes.push([w, h])
  }
  addTile(tile: TileView, dropIn?: { fromY: number; durationMs: number }): void {
    this.added.push(tile)
    if (dropIn) this.dropIns++
  }
  moveTile(id: number, _x: number, _y: number, _d: number, bounce: boolean): void {
    this.moves.push({ id, bounce })
  }
  swapTiles(idA: number, idB: number, _ax: number, _ay: number, _bx: number, _by: number, _d: number, revert: boolean): void {
    this.swaps.push({ idA, idB, revert })
  }
  popTiles(ids: number[]): void {
    this.popped.push(...ids)
  }
  setSpecial(id: number, special: string): void {
    this.specials.push({ id, special })
  }
  burst(): void {
    this.bursts++
  }
  shake(): void {
    this.shakes++
  }
  scorePopup(): void {
    this.scorePops++
  }
  banner(kind: 'win' | 'lose' | 'shuffle'): void {
    this.banners.push(kind)
  }
  reset(): void {}
  destroy(): void {}
}

const setup = (reducedMotion = false) => {
  const engine = new FakeEngine()
  const state = engine.init(sampleMatch3, 0)
  const scene = new FakeScene()
  const controller = new BoardController(scene, sampleMatch3, {
    reducedMotion,
    viewport: { width: 640, height: 640 },
  })
  controller.seed(state)
  engine.onAny((e: EngineEvent) => controller.handle(e))
  return { engine, scene, controller }
}

describe('BoardController.seed', () => {
  it('draws one sprite per occupied cell and sizes the surface', () => {
    const { scene } = setup()
    expect(scene.added).toHaveLength(64)
    expect(scene.resizes).toHaveLength(1)
    const ids = new Set(scene.added.map((t) => t.id))
    expect(ids.size).toBe(64)
  })
})

describe('BoardController driven by a real cascade', () => {
  it('pops matched tiles, drops survivors, and refills on an accepted swap', () => {
    const { engine, scene } = setup()
    const move = engine.getAvailableMoves()[0]!
    scene.added.length = 0 // ignore the initial seed; watch the move only
    const r = engine.trySwap(move.a, move.b)

    expect(r.accepted).toBe(true)
    expect(scene.swaps.some((s) => !s.revert)).toBe(true) // accepted swap
    expect(scene.popped.length).toBeGreaterThan(0) // a match cleared
    expect(scene.added.length).toBeGreaterThan(0) // refill added new tiles
    expect(scene.dropIns).toBe(scene.added.length) // every refill tile drops in
    expect(scene.scorePops).toBeGreaterThan(0)
    // gravity may legitimately move 0 tiles (e.g. a top-row clear); just ensure
    // every recorded fall used the game-spring bounce.
    expect(scene.moves.every((m) => m.bounce)).toBe(true)
  })

  it('throws particles with motion on, and none under reduced motion', () => {
    const on = setup(false)
    const m1 = on.engine.getAvailableMoves()[0]!
    on.engine.trySwap(m1.a, m1.b)
    expect(on.scene.bursts).toBeGreaterThan(0)

    const off = setup(true)
    const m2 = off.engine.getAvailableMoves()[0]!
    off.engine.trySwap(m2.a, m2.b)
    expect(off.scene.bursts).toBe(0)
  })

  it('reverts a rejected (no-match) swap without changing tiles', () => {
    const { engine, scene } = setup()
    // find an adjacent pair that does NOT match
    const st = engine.getState()
    let rejected: { a: { x: number; y: number }; b: { x: number; y: number } } | null = null
    for (let y = 0; y < st.height && !rejected; y++) {
      for (let x = 0; x < st.width - 1; x++) {
        const moves = engine.getAvailableMoves()
        const isMove = moves.some(
          (mv) => mv.a.x === x && mv.a.y === y && mv.b.x === x + 1 && mv.b.y === y,
        )
        if (!isMove) {
          rejected = { a: { x, y }, b: { x: x + 1, y } }
          break
        }
      }
    }
    expect(rejected).not.toBeNull()
    scene.swaps.length = 0
    const r = engine.trySwap(rejected!.a, rejected!.b)
    expect(r.accepted).toBe(false)
    expect(scene.swaps).toHaveLength(1)
    expect(scene.swaps[0]!.revert).toBe(true)
  })

  it('shows a win banner when the goal is met', () => {
    const engine = new FakeEngine()
    const def = { ...sampleMatch3, id: 'win', levels: [{ index: 0, goal: { kind: 'score' as const, target: 1 }, moveLimit: 50 }] }
    const state = engine.init(def, 0)
    const scene = new FakeScene()
    const controller = new BoardController(scene, def, { reducedMotion: false, viewport: { width: 640, height: 640 } })
    controller.seed(state)
    engine.onAny((e) => controller.handle(e))
    const m = engine.getAvailableMoves()[0]!
    engine.trySwap(m.a, m.b)
    expect(scene.banners).toContain('win')
  })
})
