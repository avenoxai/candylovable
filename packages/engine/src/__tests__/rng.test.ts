import { describe, expect, it } from 'vitest'
import { hashString, makeIdFactory, mulberry32, randInt } from '../rng'

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produces different streams for different seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })

  it('stays in [0, 1)', () => {
    const r = mulberry32(99)
    for (let i = 0; i < 1000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('randInt', () => {
  it('returns integers in [0, n) and covers the full range', () => {
    const r = mulberry32(7)
    const seen = new Set<number>()
    for (let i = 0; i < 5000; i++) {
      const v = randInt(r, 6)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(6)
      seen.add(v)
    }
    expect(seen.size).toBe(6) // every value 0..5 appears
  })
})

describe('makeIdFactory', () => {
  it('increments from 1 by default', () => {
    const next = makeIdFactory()
    expect([next(), next(), next()]).toEqual([1, 2, 3])
  })

  it('honors a custom start and never repeats', () => {
    const next = makeIdFactory(100)
    const ids = Array.from({ length: 50 }, () => next())
    expect(ids[0]).toBe(100)
    expect(new Set(ids).size).toBe(50)
  })
})

describe('hashString', () => {
  it('is deterministic and order-sensitive', () => {
    expect(hashString('gems-match3')).toBe(hashString('gems-match3'))
    expect(hashString('ab')).not.toBe(hashString('ba'))
  })

  it('returns an unsigned 32-bit integer', () => {
    const h = hashString('any-game-id')
    expect(Number.isInteger(h)).toBe(true)
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThanOrEqual(0xffffffff)
  })
})
