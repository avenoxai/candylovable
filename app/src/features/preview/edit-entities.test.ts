import { sampleMatch3 } from '@candylovable/mocks'
import { describe, expect, it } from 'vitest'
import { entitiesFor } from './edit-entities'

describe('entitiesFor', () => {
  it('derives one entity per tile colour plus the background and goal', () => {
    const entities = entitiesFor(sampleMatch3)
    const tiles = entities.filter((e) => e.kind === 'tile')
    expect(tiles).toHaveLength(sampleMatch3.theme.tiles.length)
    expect(entities.some((e) => e.kind === 'background')).toBe(true)
    expect(entities.some((e) => e.kind === 'goal')).toBe(true)
  })

  it('references tiles by colorId and gives them a palette swatch', () => {
    const tile0 = entitiesFor(sampleMatch3).find((e) => e.kind === 'tile' && e.ref === '0')
    expect(tile0).toBeDefined()
    expect(tile0?.swatch).toBe(sampleMatch3.theme.palette[0])
  })
})
