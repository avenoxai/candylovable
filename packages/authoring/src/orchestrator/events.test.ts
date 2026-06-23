import type { GenerationEventType } from '@candylovable/contract'
import { describe, expect, it } from 'vitest'
import { ev } from './events'

describe('GenerationEvent builders', () => {
  it('build the exact contract event shapes', () => {
    expect(ev.plan(['design', 'build'])).toEqual({ type: 'plan', steps: ['design', 'build'] })
    expect(ev.step('s1', 'Rules', 'start', 'rules')).toEqual({
      type: 'step',
      id: 's1',
      label: 'Rules',
      status: 'start',
      kind: 'rules',
    })
    expect(ev.error('boom', false)).toEqual({ type: 'error', message: 'boom', recoverable: false })
    expect(ev.done()).toEqual({ type: 'done' })
  })

  it('cover every event type in the union', () => {
    const types: GenerationEventType[] = [
      ev.plan([]).type,
      ev.step('i', 'l', 'done', 'design').type,
      ev.token('x').type,
      ev.partial({}).type,
      ev.designDirections([]).type,
      ev.done().type,
      ev.error('e', true).type,
    ]
    expect(new Set(types).size).toBe(7)
  })
})
