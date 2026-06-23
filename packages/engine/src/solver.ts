import { type Cell, type Coord, type Tile, toIndex } from '@candylovable/contract'
import { generateBoard, findMatches } from './board'
import { type Rng, randInt } from './rng'

const swap = (cells: Cell[], a: Coord, b: Coord, width: number): void => {
  const ia = toIndex(a.x, a.y, width)
  const ib = toIndex(b.x, b.y, width)
  const tmp = cells[ia] as Cell
  cells[ia] = cells[ib] as Cell
  cells[ib] = tmp
}

export interface DetectedMove {
  a: Coord
  b: Coord
}

/**
 * Every swap (with the right or down neighbour) that yields at least one match.
 * Scans (right, then down) per cell in row-major order — deterministic.
 *
 * NOTE: special-activation moves (colorBomb adjacent to anything, two adjacent
 * specials) are added by the engine in P2 once specials exist; this is the pure
 * match-based detector (FakeEngine parity).
 */
export const findAvailableMoves = (
  cells: Cell[],
  width: number,
  height: number,
  minMatch: number,
): DetectedMove[] => {
  const moves: DetectedMove[] = []
  const test = (a: Coord, b: Coord): void => {
    swap(cells, a, b, width)
    if (findMatches(cells, width, height, minMatch).length > 0) moves.push({ a, b })
    swap(cells, a, b, width)
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x + 1 < width) test({ x, y }, { x: x + 1, y })
      if (y + 1 < height) test({ x, y }, { x, y: y + 1 })
    }
  }
  return moves
}

export const hasAvailableMove = (
  cells: Cell[],
  width: number,
  height: number,
  minMatch: number,
): boolean => findAvailableMoves(cells, width, height, minMatch).length > 0

/**
 * Reshuffle existing tiles (preserve the colour multiset) until the board has no
 * immediate matches AND at least one available move. Falls back to a fresh
 * generated board if shuffling can't satisfy both within `maxAttempts`.
 * Mirrors the FakeEngine shuffle (RNG draw order preserved for parity).
 */
export const shuffleBoard = (
  cells: Cell[],
  width: number,
  height: number,
  minMatch: number,
  colorCount: number,
  rng: Rng,
  nextId: () => number,
  maxAttempts = 50,
): void => {
  const tiles = cells.filter((c): c is Tile => c !== null)
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const colors = tiles.map((t) => t.colorId)
    for (let i = colors.length - 1; i > 0; i--) {
      const j = randInt(rng, i + 1)
      const tmp = colors[i] as number
      colors[i] = colors[j] as number
      colors[j] = tmp
    }
    tiles.forEach((t, i) => {
      t.colorId = colors[i] as number
    })
    let k = 0
    for (let i = 0; i < cells.length; i++) {
      if (cells[i]) cells[i] = tiles[k++] as Cell
    }
    if (
      findMatches(cells, width, height, minMatch).length === 0 &&
      hasAvailableMove(cells, width, height, minMatch)
    ) {
      return
    }
  }
  const fresh = generateBoard(width, height, colorCount, rng, nextId)
  for (let i = 0; i < cells.length; i++) cells[i] = fresh[i] as Cell
}
