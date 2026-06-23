import { type Cell, type Coord, type Tile, toIndex } from '@candylovable/contract'
import { type Rng, makeIdFactory, randInt } from './rng'

// ---------------------------------------------------------------------------
// Colour access (special-aware)
// ---------------------------------------------------------------------------

/**
 * Colour used for run-matching. A `colorBomb` is colour-NEUTRAL — it never
 * participates in a normal colour run (it only activates by being swapped), so
 * a run breaks across it. Striped/wrapped/fish keep their colour and CAN be
 * matched (matching one detonates it — handled by the engine cascade).
 */
export const matchColorAt = (cells: Cell[], x: number, y: number, width: number): number | null => {
  const cell = cells[toIndex(x, y, width)]
  if (!cell || cell.special === 'colorBomb') return null
  return cell.colorId
}

// ---------------------------------------------------------------------------
// No-initial-match board generation
// ---------------------------------------------------------------------------

/**
 * Build a board with NO initial matches, constructively (O(n), no rejection):
 * when filling a cell, forbid any colour that would complete a triple with the
 * two already-placed neighbours to the left and below. (match3-research §solvable)
 */
export const generateBoard = (
  width: number,
  height: number,
  colorCount: number,
  rng: Rng,
  nextId: () => number,
): Cell[] => {
  if (colorCount < 3) throw new Error('generateBoard needs at least 3 colours')
  const cells: Cell[] = new Array<Cell>(width * height).fill(null)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const forbidden = new Set<number>()
      if (x >= 2) {
        const a = cells[toIndex(x - 1, y, width)]
        const b = cells[toIndex(x - 2, y, width)]
        if (a && b && a.colorId === b.colorId) forbidden.add(a.colorId)
      }
      if (y >= 2) {
        const a = cells[toIndex(x, y - 1, width)]
        const b = cells[toIndex(x, y - 2, width)]
        if (a && b && a.colorId === b.colorId) forbidden.add(a.colorId)
      }
      let color = randInt(rng, colorCount)
      while (forbidden.has(color)) color = randInt(rng, colorCount)
      cells[toIndex(x, y, width)] = { colorId: color, special: null, id: nextId() }
    }
  }
  return cells
}

// ---------------------------------------------------------------------------
// Match detection (run scan + flood-fill grouping + shape classification)
// ---------------------------------------------------------------------------

export interface MatchGroup {
  cells: Coord[]
  size: number
  /** Longest straight (horizontal or vertical) run inside the group. */
  maxRun: number
  shape: 'line' | 'L' | 'T' | 'square'
  colorId: number
}

/**
 * Mark every cell that is part of a horizontal or vertical run `>= minMatch`,
 * then flood-fill connected same-colour matched cells into {@link MatchGroup}s
 * (so an L/T shape is ONE group, which is what special creation needs — a naive
 * linear scan would split it into two).
 */
export const findMatches = (
  cells: Cell[],
  width: number,
  height: number,
  minMatch: number,
): MatchGroup[] => {
  const matched = new Array<boolean>(width * height).fill(false)

  for (let y = 0; y < height; y++) {
    let x = 0
    while (x < width) {
      const color = matchColorAt(cells, x, y, width)
      if (color === null) {
        x++
        continue
      }
      let end = x + 1
      while (end < width && matchColorAt(cells, end, y, width) === color) end++
      if (end - x >= minMatch) for (let k = x; k < end; k++) matched[toIndex(k, y, width)] = true
      x = end
    }
  }
  for (let x = 0; x < width; x++) {
    let y = 0
    while (y < height) {
      const color = matchColorAt(cells, x, y, width)
      if (color === null) {
        y++
        continue
      }
      let end = y + 1
      while (end < height && matchColorAt(cells, x, end, width) === color) end++
      if (end - y >= minMatch) for (let k = y; k < end; k++) matched[toIndex(x, k, width)] = true
      y = end
    }
  }

  const visited = new Array<boolean>(width * height).fill(false)
  const groups: MatchGroup[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = toIndex(x, y, width)
      if (!matched[i] || visited[i]) continue
      const color = matchColorAt(cells, x, y, width) as number
      const stack: Coord[] = [{ x, y }]
      const groupCells: Coord[] = []
      visited[i] = true
      while (stack.length) {
        const c = stack.pop() as Coord
        groupCells.push(c)
        const neighbours: Coord[] = [
          { x: c.x + 1, y: c.y },
          { x: c.x - 1, y: c.y },
          { x: c.x, y: c.y + 1 },
          { x: c.x, y: c.y - 1 },
        ]
        for (const n of neighbours) {
          if (n.x < 0 || n.x >= width || n.y < 0 || n.y >= height) continue
          const ni = toIndex(n.x, n.y, width)
          if (matched[ni] && !visited[ni] && matchColorAt(cells, n.x, n.y, width) === color) {
            visited[ni] = true
            stack.push(n)
          }
        }
      }
      groups.push(classifyGroup(groupCells, color))
    }
  }
  return groups
}

const longestContiguous = (vals: number[]): number => {
  const s = [...vals].sort((a, b) => a - b)
  let best = 1
  let cur = 1
  for (let k = 1; k < s.length; k++) {
    cur = s[k] === (s[k - 1] as number) + 1 ? cur + 1 : 1
    if (cur > best) best = cur
  }
  return best
}

export const classifyGroup = (groupCells: Coord[], colorId: number): MatchGroup => {
  const xs = new Set(groupCells.map((c) => c.x))
  const ys = new Set(groupCells.map((c) => c.y))
  const spansBoth = xs.size > 1 && ys.size > 1

  let maxRun = 1
  const byRow = new Map<number, number[]>()
  const byCol = new Map<number, number[]>()
  for (const c of groupCells) {
    ;(byRow.get(c.y) ?? byRow.set(c.y, []).get(c.y)!).push(c.x)
    ;(byCol.get(c.x) ?? byCol.set(c.x, []).get(c.x)!).push(c.y)
  }
  for (const vals of byRow.values()) maxRun = Math.max(maxRun, longestContiguous(vals))
  for (const vals of byCol.values()) maxRun = Math.max(maxRun, longestContiguous(vals))

  let shape: MatchGroup['shape']
  if (groupCells.length === 4 && xs.size === 2 && ys.size === 2) shape = 'square'
  else if (!spansBoth) shape = 'line'
  else shape = maxRun >= 3 ? 'T' : 'L'

  return { cells: groupCells, size: groupCells.length, maxRun, shape, colorId }
}

// ---------------------------------------------------------------------------
// Cascade primitives: clear / gravity / refill
// ---------------------------------------------------------------------------

export const clearCells = (cells: Cell[], coords: Iterable<Coord>, width: number): void => {
  for (const c of coords) cells[toIndex(c.x, c.y, width)] = null
}

export interface GravityMove {
  from: Coord
  to: Coord
}

/** Compact each column downward (bottom-up); returns moves for the renderer. */
export const applyGravity = (cells: Cell[], width: number, height: number): GravityMove[] => {
  const moves: GravityMove[] = []
  for (let x = 0; x < width; x++) {
    let writeY = height - 1
    for (let y = height - 1; y >= 0; y--) {
      const cell = cells[toIndex(x, y, width)]
      if (cell) {
        if (writeY !== y) {
          cells[toIndex(x, writeY, width)] = cell
          cells[toIndex(x, y, width)] = null
          moves.push({ from: { x, y }, to: { x, y: writeY } })
        }
        writeY--
      }
    }
  }
  return moves
}

export interface RefillCell {
  at: Coord
  tile: Tile
}

/** Drop fresh tiles into empty cells (uniform colour); returns them for drop-in animation. */
export const refill = (
  cells: Cell[],
  width: number,
  height: number,
  colorCount: number,
  rng: Rng,
  nextId: () => number,
): RefillCell[] => {
  const out: RefillCell[] = []
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (!cells[toIndex(x, y, width)]) {
        const tile: Tile = { colorId: randInt(rng, colorCount), special: null, id: nextId() }
        cells[toIndex(x, y, width)] = tile
        out.push({ at: { x, y }, tile })
      }
    }
  }
  return out
}

export { makeIdFactory }
