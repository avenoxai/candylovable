import { describe, expect, it } from 'vitest'
import { AssetCatalog, type LibraryJson } from './catalog'

const lib: LibraryJson = {
  version: 1,
  tile_size: 256,
  kind: 'whole_sprite',
  themes: {
    candy: {
      background: { file: 'themes/candy/bg_candy.png', description: 'bg' },
      tiles: [{ colorId: 0, file: 'themes/candy/tile_candy_00.png', description: 'red heart' }],
    },
  },
  shared: {
    overlay: [{ name: 'fx_special_striped', file: 'shared/fx_special_striped.png', description: 's' }],
    blocker: [{ name: 'blocker_jelly', file: 'shared/blocker_jelly.png', description: 'j' }],
    texture_9slice: [],
    particle: [],
  },
}

describe('AssetCatalog', () => {
  const cat = new AssetCatalog(lib)

  it('lists theme ids and resolves a theme', () => {
    expect(cat.themeIds()).toEqual(['candy'])
    expect(cat.hasTheme('candy')).toBe(true)
    expect(cat.hasTheme('nope')).toBe(false)
    expect(cat.getTheme('candy')?.tiles[0]?.colorId).toBe(0)
  })

  it('lists shared assets by kind and in total', () => {
    expect(cat.shared('overlay').map((a) => a.name)).toEqual(['fx_special_striped'])
    expect(cat.shared()).toHaveLength(2)
  })

  it('validates refs by file path or shared name, and reports unknowns', () => {
    expect(cat.hasRef('themes/candy/tile_candy_00.png')).toBe(true)
    expect(cat.hasRef('blocker_jelly')).toBe(true)
    expect(cat.hasRef('themes/candy/tile_candy_99.png')).toBe(false)
    expect(cat.unknownRefs(['blocker_jelly', 'made_up.png'])).toEqual(['made_up.png'])
  })
})
