import { sampleMatch3 } from '@candylovable/mocks'
import { describe, expect, it } from 'vitest'
import { initialGenerationState, reduceGeneration } from './reducer'

describe('reduceGeneration', () => {
  it('adds a step on start and marks it done on the matching done event', () => {
    let s = reduceGeneration(initialGenerationState, {
      type: 'step',
      id: 'rules',
      label: 'Rules',
      status: 'start',
      kind: 'rules',
    })
    expect(s.steps).toHaveLength(1)
    expect(s.steps[0]!.done).toBe(false)
    s = reduceGeneration(s, { type: 'step', id: 'rules', label: 'Rules', status: 'done', kind: 'rules' })
    expect(s.steps).toHaveLength(1) // updated, not duplicated
    expect(s.steps[0]!.done).toBe(true)
  })

  it('accumulates streamed tokens', () => {
    let s = reduceGeneration(initialGenerationState, { type: 'token', text: 'Hello ' })
    s = reduceGeneration(s, { type: 'token', text: 'world' })
    expect(s.text).toBe('Hello world')
  })

  it('captures design directions and the final def', () => {
    let s = reduceGeneration(initialGenerationState, {
      type: 'designDirections',
      options: [{ id: 'gems', title: 'Gems', summary: '', themeId: 'gems', previewColors: [] }],
    })
    expect(s.directions).toHaveLength(1)
    s = reduceGeneration(s, { type: 'gameReady', def: sampleMatch3 })
    expect(s.def).toBe(sampleMatch3)
  })

  it('error wins over a later done', () => {
    let s = reduceGeneration({ ...initialGenerationState, status: 'streaming' }, {
      type: 'error',
      message: 'boom',
      recoverable: false,
    })
    expect(s.status).toBe('error')
    s = reduceGeneration(s, { type: 'done' })
    expect(s.status).toBe('error') // not overwritten
  })

  it('done marks completion from a non-error state', () => {
    const s = reduceGeneration({ ...initialGenerationState, status: 'streaming' }, { type: 'done' })
    expect(s.status).toBe('done')
  })
})
