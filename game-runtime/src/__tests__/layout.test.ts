import { describe, expect, it } from 'vitest'
import { cellCenter, computeLayout, pixelToCell } from '../layout'

describe('computeLayout', () => {
  it('produces a positive square cell that fits the viewport', () => {
    const l = computeLayout(8, 8, 600, 800)
    expect(l.cellSize).toBeGreaterThan(0)
    expect(l.width).toBeLessThanOrEqual(600)
    expect(l.height).toBeLessThanOrEqual(800)
  })

  it('centres the board', () => {
    const l = computeLayout(8, 8, 600, 600)
    expect(l.originX).toBe(Math.floor((600 - l.width) / 2))
    expect(l.originY).toBe(Math.floor((600 - l.height) / 2))
  })

  it('limits the cell by the smaller dimension (wide viewport)', () => {
    const wide = computeLayout(8, 8, 2000, 400)
    const tall = computeLayout(8, 8, 400, 400)
    expect(wide.cellSize).toBe(tall.cellSize)
  })
})

describe('cellCenter ↔ pixelToCell', () => {
  it('round-trips every cell centre back to its coordinate', () => {
    const l = computeLayout(8, 8, 640, 640)
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const { px, py } = cellCenter(l, x, y)
        expect(pixelToCell(l, px, py)).toEqual({ x, y })
      }
    }
  })

  it('returns null outside the board', () => {
    const l = computeLayout(8, 8, 640, 640)
    expect(pixelToCell(l, -10, -10)).toBeNull()
    expect(pixelToCell(l, 100000, 100000)).toBeNull()
  })

  it('returns null for a hit that lands in the gap between cells', () => {
    const l = computeLayout(4, 4, 400, 400)
    // a point just inside the outer gap, before the first cell starts
    const gapHit = pixelToCell(l, l.originX + 1, l.originY + 1)
    expect(gapHit).toBeNull()
  })
})
