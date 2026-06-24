import type { SpecialKind } from '@candylovable/contract'

/** A tile to draw (pixel-centred). */
export interface TileView {
  id: number
  colorId: number
  special: SpecialKind | null
  /** Pixel centre. */
  x: number
  y: number
  size: number
  /** Theme sprite URL. Drawn as the tile art; falls back to a colored tile if absent or it fails to load. */
  texUrl?: string
}

/**
 * Render surface the {@link BoardController} drives. Kept abstract so the
 * orchestration logic is unit-testable with a fake; {@link PixiScene} is the
 * real WebGL implementation (browser-only, covered by Playwright).
 * All durations are milliseconds.
 */
export interface Scene {
  resize(width: number, height: number): void
  /** Add a tile. With `dropIn`, animate it falling in from `fromY` (refill). */
  addTile(tile: TileView, dropIn?: { fromY: number; durationMs: number }): void
  moveTile(id: number, x: number, y: number, durationMs: number, bounce: boolean): void
  swapTiles(
    idA: number,
    idB: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    durationMs: number,
    revert: boolean,
  ): void
  /** Pop (scale + fade) then remove the tiles. */
  popTiles(ids: number[], intensity: number, durationMs: number): void
  setSpecial(id: number, special: SpecialKind): void
  /** Particle burst at a pixel point. */
  burst(x: number, y: number, count: number, color: string): void
  shake(intensity: number, durationMs: number): void
  scorePopup(delta: number, intensity: number, x: number, y: number): void
  banner(kind: 'win' | 'lose' | 'shuffle', detail: { stars?: number; nearMiss?: boolean }): void
  reset(): void
  destroy(): void
}
