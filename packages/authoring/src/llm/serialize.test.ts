import { describe, expect, it } from 'vitest'
import { canonicalJSON } from './serialize'

describe('canonicalJSON', () => {
  it('produces identical bytes regardless of key insertion order', () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toBe(canonicalJSON({ a: 2, b: 1 }))
  })

  it('sorts nested object keys too', () => {
    expect(canonicalJSON({ x: { d: 1, c: 2 } })).toBe('{"x":{"c":2,"d":1}}')
  })

  it('preserves array order (order is semantic, not sorted)', () => {
    expect(canonicalJSON([3, 1, 2])).toBe('[3,1,2]')
  })
})
