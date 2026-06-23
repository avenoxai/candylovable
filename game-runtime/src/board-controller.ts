import {
  type Coord,
  type EngineEvent,
  type GameDefinition,
  type GameState,
  toIndex,
} from '@candylovable/contract'
import { type BoardLayout, cellCenter, computeLayout } from './layout'
import { type JuiceDirective, mapEvent } from './juice'
import type { Scene } from './scene'

export interface BoardControllerOptions {
  reducedMotion: boolean
  viewport: { width: number; height: number }
}

const sec2ms = (s: number): number => Math.round(s * 1000)

/**
 * Orchestrates a {@link Scene} from engine state + {@link EngineEvent}s. Keeps its
 * own tileId-per-cell model (so it can resolve event coords → sprites without
 * racing the engine), and uses {@link mapEvent} for all juice intensities/timings.
 * Pure of Pixi → fully unit-testable with a fake Scene.
 */
export class BoardController {
  private model: (number | null)[] = []
  private readonly idColor = new Map<number, number>()
  private layout: BoardLayout
  private readonly rm: boolean

  constructor(
    private readonly scene: Scene,
    private readonly def: GameDefinition,
    opts: BoardControllerOptions,
  ) {
    this.rm = opts.reducedMotion
    this.layout = computeLayout(
      def.board.width,
      def.board.height,
      opts.viewport.width,
      opts.viewport.height,
    )
  }

  private idx(c: Coord): number {
    return toIndex(c.x, c.y, this.def.board.width)
  }

  private center(c: Coord): { px: number; py: number } {
    return cellCenter(this.layout, c.x, c.y)
  }

  private boardCenter(): { px: number; py: number } {
    return { px: this.layout.originX + this.layout.width / 2, py: this.layout.originY + this.layout.height / 2 }
  }

  private color(colorId: number): string {
    return this.def.theme.palette[colorId] ?? '#ffffff'
  }

  /** Seed from the engine's initial state: draw every tile. */
  seed(state: GameState): void {
    this.model = new Array<number | null>(state.cells.length).fill(null)
    this.idColor.clear()
    this.scene.resize(this.layout.width, this.layout.height)
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const cell = state.cells[toIndex(x, y, state.width)]
        if (!cell) continue
        const i = toIndex(x, y, state.width)
        this.model[i] = cell.id
        this.idColor.set(cell.id, cell.colorId)
        const { px, py } = this.center({ x, y })
        this.scene.addTile({
          id: cell.id,
          colorId: cell.colorId,
          special: cell.special,
          x: px,
          y: py,
          size: this.layout.cellSize,
        })
      }
    }
  }

  /** Handle one engine event, updating the model and driving the scene. */
  handle(e: EngineEvent): void {
    const dirs = mapEvent(e, { juice: this.def.juice, reducedMotion: this.rm })
    switch (e.type) {
      case 'swap':
        return this.onSwap(e, dirs)
      case 'match':
        return this.onMatch(e, dirs)
      case 'gravity':
        return this.onGravity(e, dirs)
      case 'refill':
        return this.onRefill(e, dirs)
      case 'spawnSpecial': {
        const id = this.model[this.idx(e.at)]
        if (id != null) this.scene.setSpecial(id, e.kind)
        return
      }
      case 'specialDetonate': {
        const shake = find(dirs, 'shake')
        if (shake) this.scene.shake(shake.intensity, sec2ms(shake.duration))
        return
      }
      case 'score':
        return this.onScore(e, dirs)
      case 'win':
        return this.scene.banner('win', { stars: e.stars })
      case 'lose':
        return this.scene.banner('lose', { nearMiss: (e.shortBy ?? 0) > 0 })
      case 'shuffle':
        return this.scene.banner('shuffle', {})
      default:
        return
    }
  }

  private onSwap(e: Extract<EngineEvent, { type: 'swap' }>, dirs: JuiceDirective[]): void {
    const dir = find(dirs, 'swap')
    const dur = sec2ms(dir?.duration ?? 0.12)
    const ia = this.idx(e.a)
    const ib = this.idx(e.b)
    const idA = this.model[ia]
    const idB = this.model[ib]
    if (idA == null || idB == null) return
    if (e.accepted) {
      this.model[ia] = idB
      this.model[ib] = idA
    }
    const a = this.center(e.a)
    const b = this.center(e.b)
    this.scene.swapTiles(idA, idB, a.px, a.py, b.px, b.py, dur, !e.accepted)
  }

  private onMatch(e: Extract<EngineEvent, { type: 'match' }>, dirs: JuiceDirective[]): void {
    const pop = find(dirs, 'pop')
    const particles = find(dirs, 'particles')
    const ids: number[] = []
    const bursts: { x: number; y: number; color: string }[] = []
    for (const c of e.cells) {
      const id = this.model[this.idx(c)]
      if (id == null) continue
      ids.push(id)
      const { px, py } = this.center(c)
      bursts.push({ x: px, y: py, color: this.color(this.idColor.get(id) ?? 0) })
    }
    if (ids.length) this.scene.popTiles(ids, pop?.intensity ?? 0.5, sec2ms(pop?.duration ?? 0.18))
    if (particles && bursts.length) {
      const per = Math.max(1, Math.round(particles.count / bursts.length))
      for (const b of bursts) this.scene.burst(b.x, b.y, per, b.color)
    }
    // remove cleared tiles from the model
    for (const c of e.cells) {
      const id = this.model[this.idx(c)]
      if (id != null) this.idColor.delete(id)
      this.model[this.idx(c)] = null
    }
  }

  private onGravity(e: Extract<EngineEvent, { type: 'gravity' }>, dirs: JuiceDirective[]): void {
    const dur = sec2ms(find(dirs, 'fall')?.duration ?? 0.22)
    // Resolve all source ids first, then clear sources, then place at targets —
    // avoids clobbering when a target equals another move's source.
    const ids = e.moves.map((m) => this.model[this.idx(m.from)])
    for (const m of e.moves) this.model[this.idx(m.from)] = null
    e.moves.forEach((m, i) => {
      const id = ids[i]
      if (id == null) return
      this.model[this.idx(m.to)] = id
      const { px, py } = this.center(m.to)
      this.scene.moveTile(id, px, py, dur, true)
    })
  }

  private onRefill(e: Extract<EngineEvent, { type: 'refill' }>, dirs: JuiceDirective[]): void {
    const dur = sec2ms(find(dirs, 'dropIn')?.duration ?? 0.24)
    for (const { at, tile } of e.cells) {
      this.model[this.idx(at)] = tile.id
      this.idColor.set(tile.id, tile.colorId)
      const { px, py } = this.center(at)
      const startY = this.layout.originY - (at.y + 1) * (this.layout.cellSize + this.layout.gap)
      this.scene.addTile(
        { id: tile.id, colorId: tile.colorId, special: tile.special, x: px, y: py, size: this.layout.cellSize },
        { fromY: startY, durationMs: dur },
      )
    }
  }

  private onScore(e: Extract<EngineEvent, { type: 'score' }>, dirs: JuiceDirective[]): void {
    const dir = find(dirs, 'scorePopup')
    const at = e.at ? this.center(e.at) : this.boardCenter()
    this.scene.scorePopup(e.delta, dir?.intensity ?? 0.3, at.px, at.py)
  }
}

const find = <K extends JuiceDirective['kind']>(
  dirs: JuiceDirective[],
  kind: K,
): Extract<JuiceDirective, { kind: K }> | undefined =>
  dirs.find((d) => d.kind === kind) as Extract<JuiceDirective, { kind: K }> | undefined
