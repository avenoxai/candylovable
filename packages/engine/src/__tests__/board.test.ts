import { describe, expect, it } from 'vitest'
import { type Cell, type SpecialKind, type Tile, toIndex } from '@candylovable/contract'
import {
  applyGravity,
  classifyGroup,
  clearCells,
  findMatches,
  generateBoard,
  matchColorAt,
  refill,
} from '../board'
import { makeIdFactory, mulberry32 } from '../rng'

// --- helpers ---------------------------------------------------------------

const ids = makeIdFactory()
const t = (colorId: number, special: SpecialKind | null = null): Tile => ({
  colorId,
  special,
  id: ids(),
})

/** Build a flat board from a 2D grid of colorIds; -1 = null (empty) cell. */
const build = (rows: number[][]): { cells: Cell[]; width: number; height: number } => {
  const height = rows.length
  const width = (rows[0] as number[]).length
  const cells: Cell[] = new Array<Cell>(width * height).fill(null)
  for (let y = 0; y < height; y++) {
    const row = rows[y] as number[]
    for (let x = 0; x < width; x++) {
      const c = row[x] as number
      cells[toIndex(x, y, width)] = c < 0 ? null : t(c)
    }
  }
  return { cells, width, height }
}

const colorGrid = (cells: Cell[], width: number, height: number): number[][] =>
  Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => cells[toIndex(x, y, width)]?.colorId ?? -1),
  )

// --- generateBoard ---------------------------------------------------------

describe('generateBoard', () => {
  it('produces no initial matches across many seeds', () => {
    for (let seed = 0; seed < 40; seed++) {
      const rng = mulberry32(seed)
      const cells = generateBoard(8, 8, 6, rng, makeIdFactory())
      expect(findMatches(cells, 8, 8, 3)).toHaveLength(0)
    }
  })

  it('fills the whole board with valid colorIds', () => {
    const cells = generateBoard(8, 8, 6, mulberry32(3), makeIdFactory())
    expect(cells).toHaveLength(64)
    for (const c of cells) {
      expect(c).not.toBeNull()
      expect((c as Tile).colorId).toBeGreaterThanOrEqual(0)
      expect((c as Tile).colorId).toBeLessThan(6)
    }
  })

  it('is deterministic for a fixed seed', () => {
    const a = generateBoard(6, 6, 5, mulberry32(42), makeIdFactory())
    const b = generateBoard(6, 6, 5, mulberry32(42), makeIdFactory())
    expect(colorGrid(a, 6, 6)).toEqual(colorGrid(b, 6, 6))
  })

  it('throws when given fewer than 3 colours (would be unsolvable)', () => {
    expect(() => generateBoard(8, 8, 2, mulberry32(1), makeIdFactory())).toThrow()
  })
})

// --- matchColorAt ----------------------------------------------------------

describe('matchColorAt', () => {
  it('returns the colorId of a normal tile', () => {
    const { cells, width } = build([[2, 3]])
    expect(matchColorAt(cells, 0, 0, width)).toBe(2)
  })

  it('returns null for an empty cell', () => {
    const { cells, width } = build([[-1, 3]])
    expect(matchColorAt(cells, 0, 0, width)).toBeNull()
  })

  it('treats a colorBomb as colour-neutral (null)', () => {
    const width = 1
    const cells: Cell[] = [t(0, 'colorBomb')]
    expect(matchColorAt(cells, 0, 0, width)).toBeNull()
  })
})

// --- findMatches -----------------------------------------------------------

describe('findMatches', () => {
  it('detects a horizontal run of 3 as one line group', () => {
    const { cells, width, height } = build([
      [1, 1, 1, 2],
      [3, 4, 5, 0],
    ])
    const groups = findMatches(cells, width, height, 3)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.size).toBe(3)
    expect(groups[0]?.shape).toBe('line')
    expect(groups[0]?.maxRun).toBe(3)
    expect(groups[0]?.colorId).toBe(1)
  })

  it('detects a vertical run of 4', () => {
    const { cells, width, height } = build([[2], [2], [2], [2]])
    const groups = findMatches(cells, width, height, 3)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.size).toBe(4)
    expect(groups[0]?.shape).toBe('line')
    expect(groups[0]?.maxRun).toBe(4)
  })

  it('returns nothing when there is no run >= minMatch', () => {
    const { cells, width, height } = build([
      [0, 1, 0],
      [1, 0, 1],
      [0, 1, 0],
    ])
    expect(findMatches(cells, width, height, 3)).toHaveLength(0)
  })

  it('groups a bent (corner) shape into one group — classified T (3-run on each axis)', () => {
    // vertical run of 3 at x=0 + horizontal run of 3 along y=2, sharing (0,2).
    // Both arms reach length 3, so the maxRun>=3 heuristic labels it T (parity with FakeEngine).
    const { cells, width, height } = build([
      [7, 1, 2],
      [7, 3, 4],
      [7, 7, 7],
    ])
    const groups = findMatches(cells, width, height, 3)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.size).toBe(5)
    expect(groups[0]?.shape).toBe('T')
  })

  it('classifies a T-shape', () => {
    // horizontal run of 3 across the top + vertical run of 3 down the middle
    const { cells, width, height } = build([
      [5, 5, 5],
      [1, 5, 2],
      [3, 5, 4],
    ])
    const groups = findMatches(cells, width, height, 3)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.size).toBe(5)
    expect(groups[0]?.shape).toBe('T')
  })

  it('lets a colorBomb break a colour run', () => {
    const width = 5
    const height = 1
    const cells: Cell[] = [t(0), t(0), t(0, 'colorBomb'), t(0), t(0)]
    // runs of 2 on each side of the neutral bomb → no match
    expect(findMatches(cells, width, height, 3)).toHaveLength(0)
  })

  it('finds two separate same-colour groups', () => {
    const { cells, width, height } = build([
      [1, 1, 1, 9, 2, 2, 2],
    ])
    const groups = findMatches(cells, width, height, 3)
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.colorId).sort()).toEqual([1, 2])
  })
})

// --- classifyGroup (unit) --------------------------------------------------

describe('classifyGroup', () => {
  it('labels a straight run as line', () => {
    const g = classifyGroup([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], 1)
    expect(g.shape).toBe('line')
    expect(g.maxRun).toBe(3)
  })

  it('labels a 2x2 block as square', () => {
    const g = classifyGroup(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
      4,
    )
    expect(g.shape).toBe('square')
    expect(g.size).toBe(4)
  })

  it('labels a bent shape with no 3-run as L (maxRun < 3)', () => {
    // spans both axes but the longest straight run is only 2 → L
    const g = classifyGroup([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], 2)
    expect(g.shape).toBe('L')
    expect(g.maxRun).toBe(2)
  })
})

// --- applyGravity ----------------------------------------------------------

describe('applyGravity', () => {
  it('compacts a column downward and reports the moves', () => {
    // column: top tile floating above two holes
    const { cells, width, height } = build([[5], [-1], [-1]])
    const moves = applyGravity(cells, width, height)
    expect(colorGrid(cells, width, height)).toEqual([[-1], [-1], [5]])
    expect(moves).toEqual([{ from: { x: 0, y: 0 }, to: { x: 0, y: 2 } }])
  })

  it('leaves a settled column untouched', () => {
    const { cells, width, height } = build([[-1], [3], [4]])
    const moves = applyGravity(cells, width, height)
    expect(colorGrid(cells, width, height)).toEqual([[-1], [3], [4]])
    expect(moves).toHaveLength(0)
  })

  it('handles interleaved holes per column independently', () => {
    const { cells, width, height } = build([
      [1, -1],
      [-1, 2],
      [3, -1],
    ])
    applyGravity(cells, width, height)
    expect(colorGrid(cells, width, height)).toEqual([
      [-1, -1],
      [1, -1],
      [3, 2],
    ])
  })
})

// --- refill ----------------------------------------------------------------

describe('refill', () => {
  it('fills every empty cell and returns the added tiles', () => {
    const { cells, width, height } = build([
      [-1, 1],
      [-1, -1],
    ])
    const added = refill(cells, width, height, 6, mulberry32(1), makeIdFactory())
    expect(added).toHaveLength(3)
    for (const c of cells) expect(c).not.toBeNull()
    for (const a of added) {
      expect(a.tile.colorId).toBeGreaterThanOrEqual(0)
      expect(a.tile.colorId).toBeLessThan(6)
    }
  })

  it('does not touch occupied cells', () => {
    const { cells, width, height } = build([[1, 2]])
    const before = colorGrid(cells, width, height)
    const added = refill(cells, width, height, 6, mulberry32(1), makeIdFactory())
    expect(added).toHaveLength(0)
    expect(colorGrid(cells, width, height)).toEqual(before)
  })
})

// --- clearCells ------------------------------------------------------------

describe('clearCells', () => {
  it('nulls exactly the given coords', () => {
    const { cells, width, height } = build([
      [1, 2, 3],
      [4, 5, 6],
    ])
    clearCells(cells, [{ x: 0, y: 0 }, { x: 2, y: 1 }], width)
    expect(colorGrid(cells, width, height)).toEqual([
      [-1, 2, 3],
      [4, 5, -1],
    ])
  })
})
