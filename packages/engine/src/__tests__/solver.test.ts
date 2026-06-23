import { describe, expect, it } from 'vitest'
import { type Cell, type Tile, toIndex } from '@candylovable/contract'
import { findMatches, generateBoard } from '../board'
import { makeIdFactory, mulberry32 } from '../rng'
import { findAvailableMoves, hasAvailableMove, shuffleBoard } from '../solver'

const ids = makeIdFactory()
const t = (colorId: number): Tile => ({ colorId, special: null, id: ids() })
const build = (rows: number[][]): { cells: Cell[]; width: number; height: number } => {
  const height = rows.length
  const width = (rows[0] as number[]).length
  const cells: Cell[] = new Array<Cell>(width * height).fill(null)
  for (let y = 0; y < height; y++) {
    const row = rows[y] as number[]
    for (let x = 0; x < width; x++) cells[toIndex(x, y, width)] = t(row[x] as number)
  }
  return { cells, width, height }
}

describe('findAvailableMoves', () => {
  it('finds a swap that creates a match, and that swap really matches', () => {
    // swapping (2,0) with (2,1) makes row 0 = [1,1,1]
    const { cells, width, height } = build([
      [1, 1, 2],
      [3, 4, 1],
    ])
    const moves = findAvailableMoves(cells, width, height, 3)
    expect(moves.length).toBeGreaterThan(0)
    // verify each reported move genuinely yields a match
    for (const m of moves) {
      const ia = toIndex(m.a.x, m.a.y, width)
      const ib = toIndex(m.b.x, m.b.y, width)
      const tmp = cells[ia] as Cell
      cells[ia] = cells[ib] as Cell
      cells[ib] = tmp
      expect(findMatches(cells, width, height, 3).length).toBeGreaterThan(0)
      const back = cells[ia] as Cell
      cells[ia] = cells[ib] as Cell
      cells[ib] = back
    }
  })

  it('reports no moves on a board where no swap can match (2x2)', () => {
    const { cells, width, height } = build([
      [0, 1],
      [2, 3],
    ])
    expect(findAvailableMoves(cells, width, height, 3)).toHaveLength(0)
    expect(hasAvailableMove(cells, width, height, 3)).toBe(false)
  })
})

describe('shuffleBoard', () => {
  it('leaves the board with no immediate match AND at least one available move', () => {
    const cells = generateBoard(6, 6, 6, mulberry32(11), makeIdFactory())
    shuffleBoard(cells, 6, 6, 3, 6, mulberry32(123), makeIdFactory())
    expect(findMatches(cells, 6, 6, 3)).toHaveLength(0)
    expect(hasAvailableMove(cells, 6, 6, 3)).toBe(true)
  })

  it('preserves the colour multiset on the success path', () => {
    const cells = generateBoard(6, 6, 6, mulberry32(5), makeIdFactory())
    const before = cells.map((c) => (c as Tile).colorId).sort((a, b) => a - b)
    shuffleBoard(cells, 6, 6, 3, 6, mulberry32(77), makeIdFactory())
    const after = cells.map((c) => (c as Tile).colorId).sort((a, b) => a - b)
    expect(after).toEqual(before)
  })
})
