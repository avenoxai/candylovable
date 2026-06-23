import { describe, expect, it } from 'vitest'
import { THEME_IDS, resolveTheme } from '../themes'

describe('resolveTheme', () => {
  it('resolves all six catalog themes', () => {
    expect(THEME_IDS).toHaveLength(6)
    for (const id of THEME_IDS) {
      const t = resolveTheme(id)
      expect(t.id).toBe(id)
      expect(t.tiles).toHaveLength(6)
      expect(t.palette).toHaveLength(6)
    }
  })

  it('follows the asset naming contract', () => {
    const t = resolveTheme('candy')
    expect(t.background).toBe('themes/candy/bg_candy.png')
    expect(t.tiles[3]).toEqual({ colorId: 3, file: 'themes/candy/tile_candy_03.png' })
    t.tiles.forEach((tile, i) => expect(tile.colorId).toBe(i))
    expect(t.displayName).toBe('Candy')
  })
})
