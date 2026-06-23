import { type Cell, toIndex } from '@candylovable/contract'
import { describe, expect, it } from 'vitest'
import {
  applyGravity,
  findAvailableMoves,
  findMatches,
  generateBoard,
  hasAvailableMove,
  makeIdFactory,
  mulberry32,
  refill,
  shuffleBoard,
} from '../board'

/** Build a board from a 2D grid of colourIds (`-1` = empty cell). */
const fromGrid = (grid: number[][]): { cells: Cell[]; width: number; height: number } => {
  const height = grid.length
  const width = grid[0]!.length
  const cells: Cell[] = new Array<Cell>(width * height).fill(null)
  let id = 1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = grid[y]![x]!
      cells[toIndex(x, y, width)] = v < 0 ? null : { colorId: v, special: null, id: id++ }
    }
  }
  return { cells, width, height }
}

const colorCounts = (cells: Cell[]): Map<number, number> => {
  const m = new Map<number, number>()
  for (const c of cells) if (c) m.set(c.colorId, (m.get(c.colorId) ?? 0) + 1)
  return m
}

describe('generateBoard', () => {
  it('produces no initial matches across many seeds and sizes', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const rng = mulberry32(seed)
      const cells = generateBoard(8, 8, 6, rng, makeIdFactory())
      expect(findMatches(cells, 8, 8, 3)).toHaveLength(0)
    }
  })

  it('fills every cell and assigns unique ids', () => {
    const cells = generateBoard(6, 7, 5, mulberry32(42), makeIdFactory())
    expect(cells).toHaveLength(42)
    expect(cells.every((c) => c !== null)).toBe(true)
    const ids = new Set(cells.map((c) => c!.id))
    expect(ids.size).toBe(42)
  })

  it('throws below 3 colours (impossible to avoid forced triples)', () => {
    expect(() => generateBoard(8, 8, 2, mulberry32(1), makeIdFactory())).toThrow()
  })
})

describe('findMatches', () => {
  it('detects a horizontal triple', () => {
    const { cells, width, height } = fromGrid([
      [0, 0, 0, 1],
      [2, 3, 4, 5],
      [5, 4, 3, 2],
    ])
    const groups = findMatches(cells, width, height, 3)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.size).toBe(3)
    expect(groups[0]!.shape).toBe('line')
  })

  it('detects a vertical triple', () => {
    const { cells, width, height } = fromGrid([
      [7, 1, 2],
      [7, 3, 4],
      [7, 5, 6],
    ])
    const groups = findMatches(cells, width, height, 3)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.size).toBe(3)
    expect(groups[0]!.shape).toBe('line')
  })

  it('reports maxRun for a 4-in-a-row (drives striped creation)', () => {
    const { cells, width, height } = fromGrid([
      [0, 0, 0, 0],
      [1, 2, 3, 4],
    ])
    const groups = findMatches(cells, width, height, 3)
    expect(groups[0]!.maxRun).toBe(4)
  })

  it('groups an L/T intersection into one non-line group', () => {
    const { cells, width, height } = fromGrid([
      [0, 0, 0],
      [0, 1, 2],
      [0, 3, 4],
    ])
    const groups = findMatches(cells, width, height, 3)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.size).toBe(5)
    expect(groups[0]!.shape).not.toBe('line')
  })

  it('finds nothing on a match-free board', () => {
    const { cells, width, height } = fromGrid([
      [0, 1, 0],
      [1, 0, 1],
      [0, 1, 0],
    ])
    expect(findMatches(cells, width, height, 3)).toHaveLength(0)
  })
})

describe('applyGravity', () => {
  it('compacts a single column downward and records moves', () => {
    const { cells, width, height } = fromGrid([[0], [-1], [1], [-1]])
    const moves = applyGravity(cells, width, height)
    expect(cells[toIndex(0, 3, width)]!.colorId).toBe(1)
    expect(cells[toIndex(0, 2, width)]!.colorId).toBe(0)
    expect(cells[toIndex(0, 0, width)]).toBeNull()
    expect(cells[toIndex(0, 1, width)]).toBeNull()
    expect(moves).toHaveLength(2)
  })

  it('records no moves when nothing falls', () => {
    const { cells, width, height } = fromGrid([
      [0, 1],
      [2, 3],
    ])
    expect(applyGravity(cells, width, height)).toHaveLength(0)
  })
})

describe('refill', () => {
  it('fills exactly the empty cells', () => {
    const { cells, width, height } = fromGrid([
      [-1, 0],
      [-1, 1],
    ])
    const added = refill(cells, width, height, 5, mulberry32(3), makeIdFactory(100))
    expect(added).toHaveLength(2)
    expect(cells.every((c) => c !== null)).toBe(true)
    expect(added.every((r) => r.tile.id >= 100)).toBe(true)
  })
})

describe('move detection', () => {
  it('finds a one-swap-away match', () => {
    const { cells, width, height } = fromGrid([
      [0, 0, 1],
      [2, 1, 0],
      [1, 0, 2],
    ])
    // swapping (2,0) and (2,1) makes the top row 0 0 0
    const moves = findAvailableMoves(cells, width, height, 3)
    expect(moves.length).toBeGreaterThan(0)
    expect(hasAvailableMove(cells, width, height, 3)).toBe(true)
  })

  it('reports a genuinely dead board (1×4, no triple possible) as having no moves', () => {
    // Only 2 colours on a single row of 4 — no swap can ever make 3-in-a-row.
    const { cells, width, height } = fromGrid([[0, 1, 0, 1]])
    expect(findMatches(cells, width, height, 3)).toHaveLength(0)
    expect(hasAvailableMove(cells, width, height, 3)).toBe(false)
  })
})

describe('shuffleBoard', () => {
  it('removes initial matches, yields a live board, and preserves the colour multiset', () => {
    // Starts with a row-0 triple (0 0 0); 3 colours so any regeneration fallback is valid too.
    const { cells, width, height } = fromGrid([
      [0, 0, 0, 1],
      [1, 2, 1, 2],
      [2, 1, 2, 0],
      [0, 2, 1, 2],
    ])
    const before = colorCounts(cells)
    shuffleBoard(cells, width, height, 3, 3, mulberry32(7), makeIdFactory(1000))
    expect(findMatches(cells, width, height, 3)).toHaveLength(0)
    expect(hasAvailableMove(cells, width, height, 3)).toBe(true)
    const after = colorCounts(cells)
    expect(after.get(0)).toBe(before.get(0))
    expect(after.get(1)).toBe(before.get(1))
    expect(after.get(2)).toBe(before.get(2))
  })
})
