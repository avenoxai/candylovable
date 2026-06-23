import { describe, expect, it } from 'vitest'
import {
  CONTRACT_VERSION,
  GAME_TYPES,
  SPECIAL_KINDS,
  coordEquals,
  coordKey,
  fromIndex,
  isAdjacent,
  toIndex,
} from '../index'

describe('coord helpers', () => {
  it('toIndex matches the x + y*width convention', () => {
    expect(toIndex(0, 0, 8)).toBe(0)
    expect(toIndex(3, 2, 8)).toBe(19)
    expect(toIndex(7, 7, 8)).toBe(63)
  })

  it('toIndex/fromIndex round-trip across a full 8x8 board', () => {
    const width = 8
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        expect(fromIndex(toIndex(x, y, width), width)).toEqual({ x, y })
      }
    }
  })

  it('coordKey is stable and unique per cell', () => {
    expect(coordKey({ x: 3, y: 2 })).toBe('3,2')
    const keys = new Set<string>()
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) keys.add(coordKey({ x, y }))
    expect(keys.size).toBe(64)
  })

  it('coordEquals compares by value', () => {
    expect(coordEquals({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(true)
    expect(coordEquals({ x: 1, y: 1 }, { x: 1, y: 2 })).toBe(false)
  })

  it('isAdjacent is true only for the four orthogonal neighbours', () => {
    const c = { x: 4, y: 4 }
    expect(isAdjacent(c, { x: 5, y: 4 })).toBe(true)
    expect(isAdjacent(c, { x: 3, y: 4 })).toBe(true)
    expect(isAdjacent(c, { x: 4, y: 5 })).toBe(true)
    expect(isAdjacent(c, { x: 4, y: 3 })).toBe(true)
    // diagonal, self, and far cells are not adjacent (no diagonal swaps)
    expect(isAdjacent(c, { x: 5, y: 5 })).toBe(false)
    expect(isAdjacent(c, c)).toBe(false)
    expect(isAdjacent(c, { x: 6, y: 4 })).toBe(false)
  })
})

describe('contract constants', () => {
  it('pins the contract version to 1', () => {
    expect(CONTRACT_VERSION).toBe(1)
  })

  it('lists match3 as the first-class game type', () => {
    expect(GAME_TYPES).toContain('match3')
  })

  it('exposes the canonical Candy-Crush specials', () => {
    expect(SPECIAL_KINDS).toContain('striped-h')
    expect(SPECIAL_KINDS).toContain('striped-v')
    expect(SPECIAL_KINDS).toContain('wrapped')
    expect(SPECIAL_KINDS).toContain('colorBomb')
  })
})
