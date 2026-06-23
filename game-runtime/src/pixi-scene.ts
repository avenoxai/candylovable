import { Application, Color, Container, Graphics, Text } from 'pixi.js'
import type { Scene, TileView } from './scene'
import { Tweener, easeOutBack, easeOutCubic } from './tween'

/** Vivid, distinct fallback fills per colorId (theme palette strings may be OKLCH,
 *  which Pixi can't always parse — real sprite textures replace these later). */
const DEFAULT_HEX = [0xff5a6e, 0x4aa3ff, 0x4bd07a, 0xffcf4a, 0xa970ff, 0xff944a]

const safeColor = (input: string, fallback = 0xffffff): number => {
  try {
    return new Color(input).toNumber()
  } catch {
    return fallback
  }
}

interface TileSprite {
  container: Container
  gfx: Graphics
}

/**
 * WebGL implementation of {@link Scene} (Pixi v8). Browser-only — never imported
 * by jsdom unit tests; exercised by Playwright. The orchestration that decides
 * WHAT to draw lives in the unit-tested BoardController; this just draws it.
 */
export class PixiScene implements Scene {
  private app?: Application
  private board = new Container()
  private fx = new Container()
  private readonly tiles = new Map<number, TileSprite>()
  private readonly tweener = new Tweener()
  private readonly backgroundColor: number

  constructor(opts: { backgroundColor?: string } = {}) {
    this.backgroundColor = opts.backgroundColor ? safeColor(opts.backgroundColor, 0x16140f) : 0x16140f
  }

  async init(canvas: HTMLCanvasElement, width: number, height: number): Promise<void> {
    const app = new Application()
    await app.init({ canvas, width, height, antialias: true, background: this.backgroundColor })
    app.stage.addChild(this.board)
    app.stage.addChild(this.fx)
    app.ticker.add((t) => this.tweener.update(t.deltaMS))
    this.app = app
  }

  private fill(colorId: number): number {
    return DEFAULT_HEX[colorId % DEFAULT_HEX.length] ?? 0xffffff
  }

  resize(width: number, height: number): void {
    this.app?.renderer.resize(width, height)
  }

  addTile(tile: TileView, dropIn?: { fromY: number; durationMs: number }): void {
    const container = new Container()
    container.x = tile.x
    container.y = dropIn ? dropIn.fromY : tile.y
    const gfx = new Graphics()
    const s = tile.size * 0.86
    gfx.roundRect(-s / 2, -s / 2, s, s, s * 0.22).fill(this.fill(tile.colorId))
    gfx.roundRect(-s / 2 + s * 0.15, -s / 2 + s * 0.12, s * 0.4, s * 0.2, s * 0.1).fill({ color: 0xffffff, alpha: 0.25 })
    container.addChild(gfx)
    this.board.addChild(container)
    this.tiles.set(tile.id, { container, gfx })
    if (dropIn) this.tweener.to(asXY(container), { y: tile.y }, dropIn.durationMs, easeOutBack)
  }

  moveTile(id: number, x: number, y: number, durationMs: number, bounce: boolean): void {
    const t = this.tiles.get(id)
    if (!t) return
    this.tweener.to(asXY(t.container), { x, y }, durationMs, bounce ? easeOutBack : easeOutCubic)
  }

  swapTiles(idA: number, idB: number, ax: number, ay: number, bx: number, by: number, durationMs: number, revert: boolean): void {
    const a = this.tiles.get(idA)
    const b = this.tiles.get(idB)
    if (!a || !b) return
    this.tweener.to(asXY(a.container), { x: bx, y: by }, durationMs, easeOutCubic, () => {
      if (revert) this.tweener.to(asXY(a.container), { x: ax, y: ay }, durationMs, easeOutCubic)
    })
    this.tweener.to(asXY(b.container), { x: ax, y: ay }, durationMs, easeOutCubic, () => {
      if (revert) this.tweener.to(asXY(b.container), { x: bx, y: by }, durationMs, easeOutCubic)
    })
  }

  popTiles(ids: number[], intensity: number, durationMs: number): void {
    for (const id of ids) {
      const t = this.tiles.get(id)
      if (!t) continue
      const peak = 1 + 0.25 * intensity
      this.tweener.to(asScale(t.container), { x: peak, y: peak }, durationMs * 0.4, easeOutCubic, () => {
        this.tweener.to(asScale(t.container), { x: 0, y: 0 }, durationMs * 0.6, easeOutCubic)
        this.tweener.to(asAlpha(t.container), { alpha: 0 }, durationMs * 0.6, easeOutCubic, () => {
          t.container.destroy()
          this.tiles.delete(id)
        })
      })
    }
  }

  setSpecial(id: number, _special: string): void {
    const t = this.tiles.get(id)
    if (!t) return
    // marker ring until real fx_special_* overlays are wired
    const ring = new Graphics()
    const s = t.container.getSize().width
    ring.circle(0, 0, s * 0.34).stroke({ color: 0xffffff, width: 3, alpha: 0.9 })
    t.container.addChild(ring)
  }

  burst(x: number, y: number, count: number, color: string): void {
    const tint = safeColor(color, 0xffffff)
    for (let i = 0; i < count; i++) {
      const p = new Graphics().circle(0, 0, 3).fill(tint)
      p.x = x
      p.y = y
      this.fx.addChild(p)
      const angle = Math.random() * Math.PI * 2
      const dist = 20 + Math.random() * 40
      this.tweener.to(asXY(p), { x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist }, 320, easeOutCubic)
      this.tweener.to(asAlpha(p), { alpha: 0 }, 320, easeOutCubic, () => p.destroy())
    }
  }

  shake(intensity: number, durationMs: number): void {
    const mag = intensity
    this.board.x = (Math.random() - 0.5) * mag * 2
    this.board.y = (Math.random() - 0.5) * mag * 2
    this.tweener.to(asXY(this.board), { x: 0, y: 0 }, durationMs, easeOutCubic)
  }

  scorePopup(delta: number, intensity: number, x: number, y: number): void {
    if (!this.app) return
    const text = new Text({
      text: `+${delta}`,
      style: { fill: 0xffffff, fontSize: 16 + Math.round(intensity * 16), fontWeight: '700' },
    })
    text.anchor.set(0.5)
    text.x = x
    text.y = y
    this.fx.addChild(text)
    this.tweener.to(asXY(text), { y: y - 40 }, 700, easeOutCubic)
    this.tweener.to(asAlpha(text), { alpha: 0 }, 700, easeOutCubic, () => text.destroy())
  }

  banner(kind: 'win' | 'lose' | 'shuffle', detail: { stars?: number; nearMiss?: boolean }): void {
    if (!this.app) return
    const label =
      kind === 'win'
        ? `You win! ${'★'.repeat(detail.stars ?? 1)}`
        : kind === 'lose'
          ? detail.nearMiss
            ? 'So close!'
            : 'Out of moves'
          : 'Shuffling…'
    const text = new Text({ text: label, style: { fill: 0xffffff, fontSize: 40, fontWeight: '800' } })
    text.anchor.set(0.5)
    text.x = this.app.renderer.width / 2
    text.y = this.app.renderer.height / 2
    text.alpha = 0
    this.fx.addChild(text)
    this.tweener.to(asAlpha(text), { alpha: 1 }, 220, easeOutCubic)
  }

  reset(): void {
    this.tweener.clear()
    for (const { container } of this.tiles.values()) container.destroy()
    this.tiles.clear()
    this.fx.removeChildren().forEach((c) => c.destroy())
  }

  destroy(): void {
    this.reset()
    this.app?.destroy(true)
    this.app = undefined
  }
}

// Pixi numeric props are real getters/setters; expose them as a flat record for Tweener.
const asXY = (o: { x: number; y: number }): Record<string, number> => o as unknown as Record<string, number>
const asAlpha = (o: { alpha: number }): Record<string, number> => o as unknown as Record<string, number>
const asScale = (o: { scale: { x: number; y: number } }): Record<string, number> =>
  o.scale as unknown as Record<string, number>
