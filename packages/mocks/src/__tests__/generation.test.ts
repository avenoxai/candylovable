import type { GenerationEvent } from '@candylovable/contract'
import { describe, expect, it } from 'vitest'
import { mockGenerationEvents, toSSE } from '../generation'

describe('mockGenerationEvents', () => {
  it('starts with a plan and ends with done', () => {
    const evs = mockGenerationEvents('a fruit match game')
    expect(evs[0]!.type).toBe('plan')
    expect(evs.at(-1)!.type).toBe('done')
  })

  it('emits exactly one gameReady carrying a valid GameDefinition', () => {
    const ready = mockGenerationEvents('x').filter((e) => e.type === 'gameReady')
    expect(ready).toHaveLength(1)
    const def = (ready[0] as Extract<GenerationEvent, { type: 'gameReady' }>).def
    expect(def.schemaVersion).toBe(1)
    expect(def.meta.gameType).toBe('match3')
  })

  it('derives a title from the prompt', () => {
    const ready = mockGenerationEvents('spooky ghost match three deluxe').find(
      (e) => e.type === 'gameReady',
    ) as Extract<GenerationEvent, { type: 'gameReady' }>
    expect(ready.def.meta.title).toBe('Spooky Ghost Match Three')
  })

  it('offers design directions and streams tokens', () => {
    const evs = mockGenerationEvents('x')
    expect(evs.some((e) => e.type === 'designDirections')).toBe(true)
    expect(evs.filter((e) => e.type === 'token').length).toBeGreaterThan(0)
  })
})

describe('toSSE', () => {
  it('encodes events as data lines that round-trip', () => {
    const evs = mockGenerationEvents('x')
    const body = toSSE(evs)
    const parsed = body
      .split('\n\n')
      .filter(Boolean)
      .map((chunk) => JSON.parse(chunk.replace(/^data: /, '')) as GenerationEvent)
    expect(parsed).toEqual(evs)
  })
})
