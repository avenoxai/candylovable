import { type Cell, type Coord, type Tile, toIndex } from '@candylovable/contract'

// ---------------------------------------------------------------------------
// Deterministic RNG + id factory (seeded so tests are reproducible)
// ---------------------------------------------------------------------------

export type Rng = () => number

/** Small, fast, seedable PRNG (mulberry32). Deterministic per seed. */
export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const randInt = (rng: Rng, n: number): number => Math.floor(rng() * n)

export const makeIdFactory = (start = 1): (() => number) => {
  let n = start
  return () => n++
}

// ---------------------------------------------------------------------------
// Board mutation helpers
// ---------------------------------------------------------------------------

const swapAt = (cells: Cell[], i: number, j: number): void => {
  const tmp = cells[i] as Cell
  cells[i] = cells[j] as Cell
  cells[j] = tmp
}

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
// Match detection
// ---------------------------------------------------------------------------

export interface MatchGroup {
  cells: Coord[]
  size: number
  /** Longest straight (h or v) run within the group — drives special creation. */
  maxRun: number
  shape: 'line' | 'L' | 'T' | 'square'
}

const colorAt = (cells: Cell[], x: number, y: number, width: number): number | null =>
  cells[toIndex(x, y, width)]?.colorId ?? null

/**
 * Find every matched cell (part of a horizontal or vertical run >= minMatch),
 * then group connected matched cells of the same colour into {@link MatchGroup}s.
 */
export const findMatches = (
  cells: Cell[],
  width: number,
  height: number,
  minMatch: number,
): MatchGroup[] => {
  const matched = new Array<boolean>(width * height).fill(false)

  // Horizontal runs
  for (let y = 0; y < height; y++) {
    let x = 0
    while (x < width) {
      const color = colorAt(cells, x, y, width)
      if (color === null) {
        x++
        continue
      }
      let end = x + 1
      while (end < width && colorAt(cells, end, y, width) === color) end++
      if (end - x >= minMatch) for (let k = x; k < end; k++) matched[toIndex(k, y, width)] = true
      x = end
    }
  }
  // Vertical runs
  for (let x = 0; x < width; x++) {
    let y = 0
    while (y < height) {
      const color = colorAt(cells, x, y, width)
      if (color === null) {
        y++
        continue
      }
      let end = y + 1
      while (end < height && colorAt(cells, x, end, width) === color) end++
      if (end - y >= minMatch) for (let k = y; k < end; k++) matched[toIndex(x, k, width)] = true
      y = end
    }
  }

  // Flood-fill connected matched cells (same colour) into groups
  const visited = new Array<boolean>(width * height).fill(false)
  const groups: MatchGroup[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = toIndex(x, y, width)
      if (!matched[i] || visited[i]) continue
      const color = colorAt(cells, x, y, width)
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
          if (matched[ni] && !visited[ni] && colorAt(cells, n.x, n.y, width) === color) {
            visited[ni] = true
            stack.push(n)
          }
        }
      }
      groups.push(classifyGroup(groupCells))
    }
  }
  return groups
}

const classifyGroup = (groupCells: Coord[]): MatchGroup => {
  const xs = new Set(groupCells.map((c) => c.x))
  const ys = new Set(groupCells.map((c) => c.y))
  const spansBoth = xs.size > 1 && ys.size > 1

  // longest horizontal run
  let maxRun = 1
  const byRow = new Map<number, number[]>()
  const byCol = new Map<number, number[]>()
  for (const c of groupCells) {
    ;(byRow.get(c.y) ?? byRow.set(c.y, []).get(c.y)!).push(c.x)
    ;(byCol.get(c.x) ?? byCol.set(c.x, []).get(c.x)!).push(c.y)
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
  for (const vals of byRow.values()) maxRun = Math.max(maxRun, longestContiguous(vals))
  for (const vals of byCol.values()) maxRun = Math.max(maxRun, longestContiguous(vals))

  let shape: MatchGroup['shape']
  if (groupCells.length === 4 && xs.size === 2 && ys.size === 2) shape = 'square'
  else if (!spansBoth) shape = 'line'
  else shape = maxRun >= 3 ? 'T' : 'L'

  return { cells: groupCells, size: groupCells.length, maxRun, shape }
}

// ---------------------------------------------------------------------------
// Clear / gravity / refill (the cascade primitives)
// ---------------------------------------------------------------------------

export const clearCells = (cells: Cell[], coords: Coord[], width: number): void => {
  for (const c of coords) cells[toIndex(c.x, c.y, width)] = null
}

export interface GravityMove {
  from: Coord
  to: Coord
}

/** Compact each column downward (bottom-up); returns the moves for animation. */
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

/** Fill empty cells with fresh tiles (weighted-uniform); returns them for drop-in animation. */
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

// ---------------------------------------------------------------------------
// Move detection + shuffle (avoid dead boards)
// ---------------------------------------------------------------------------

const swapCoords = (cells: Cell[], a: Coord, b: Coord, width: number): void =>
  swapAt(cells, toIndex(a.x, a.y, width), toIndex(b.x, b.y, width))

export interface DetectedMove {
  a: Coord
  b: Coord
}

/** Every swap (with right/down neighbour) that yields at least one match. */
export const findAvailableMoves = (
  cells: Cell[],
  width: number,
  height: number,
  minMatch: number,
): DetectedMove[] => {
  const moves: DetectedMove[] = []
  const test = (a: Coord, b: Coord): void => {
    swapCoords(cells, a, b, width)
    if (findMatches(cells, width, height, minMatch).length > 0) moves.push({ a, b })
    swapCoords(cells, a, b, width)
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
 * Reshuffle existing tiles (preserve the colour multiset) until the board has
 * no immediate matches AND at least one available move. Falls back to a fresh
 * generated board if shuffling can't satisfy both within `maxAttempts`.
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
    // Fisher–Yates over the colourIds, keeping tile identities
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
  // Fallback: regenerate
  const fresh = generateBoard(width, height, colorCount, rng, nextId)
  for (let i = 0; i < cells.length; i++) cells[i] = fresh[i] as Cell
}
