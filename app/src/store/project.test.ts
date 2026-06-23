import { sampleMatch3 } from '@candylovable/mocks'
import { afterEach, describe, expect, it } from 'vitest'
import { resetProjectStore, useProjectStore } from './project'

const variant = (title: string) => ({
  ...sampleMatch3,
  id: title,
  meta: { ...sampleMatch3.meta, title },
})

afterEach(resetProjectStore)

describe('useProjectStore', () => {
  it('starts with a single initial checkpoint', () => {
    const s = useProjectStore.getState()
    expect(s.history).toHaveLength(1)
    expect(s.current).toBe(sampleMatch3)
    expect(s.currentId).toBe(s.history[0]!.id)
  })

  it('commit appends a checkpoint and makes it current', () => {
    const v = variant('Spooky')
    useProjectStore.getState().commit(v, 'Spooky')
    const s = useProjectStore.getState()
    expect(s.history).toHaveLength(2)
    expect(s.current).toBe(v)
    expect(s.currentId).toBe(s.history[1]!.id)
  })

  it('restore switches the current preview to a past checkpoint', () => {
    const a = variant('A')
    const b = variant('B')
    useProjectStore.getState().commit(a, 'A')
    useProjectStore.getState().commit(b, 'B')
    const firstId = useProjectStore.getState().history[0]!.id
    useProjectStore.getState().restore(firstId)
    expect(useProjectStore.getState().current).toBe(sampleMatch3)
    expect(useProjectStore.getState().currentId).toBe(firstId)
  })

  it('committing after a restore appends (no history loss)', () => {
    useProjectStore.getState().commit(variant('A'), 'A')
    useProjectStore.getState().restore(useProjectStore.getState().history[0]!.id)
    useProjectStore.getState().commit(variant('C'), 'C')
    expect(useProjectStore.getState().history).toHaveLength(3)
    expect(useProjectStore.getState().current.meta.title).toBe('C')
  })

  it('restore ignores an unknown id', () => {
    const before = useProjectStore.getState().current
    useProjectStore.getState().restore(9999)
    expect(useProjectStore.getState().current).toBe(before)
  })
})
