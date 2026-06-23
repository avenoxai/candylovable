import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { AssetLibrary } from '@candylovable/contract'
import { describe, expect, it } from 'vitest'
import { gemsTheme, sampleMatch3 } from '../fixtures'

/** Loads the live shared asset catalog (assets/library.json) from the repo root. */
const loadLibrary = (): AssetLibrary =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'assets/library.json'), 'utf8')) as AssetLibrary

describe('sampleMatch3 fixture', () => {
  it('is internally consistent (colorCount matches tiles + palette)', () => {
    const colorCount = sampleMatch3.board.cellTypes.length
    expect(sampleMatch3.theme.tiles).toHaveLength(colorCount)
    expect(sampleMatch3.theme.palette).toHaveLength(colorCount)
    expect(sampleMatch3.rules.minMatch).toBe(3)
    expect(sampleMatch3.levels.length).toBeGreaterThan(0)
  })

  it('orders tiles by colorId 0..n', () => {
    sampleMatch3.theme.tiles.forEach((t, i) => expect(t.colorId).toBe(i))
  })
})

// Cross-lane seam guard: if the assets/visual lane changes the gems theme naming
// or shape in assets/library.json, this fails so the FE fixture is updated in step.
describe('gemsTheme ↔ assets/library.json seam', () => {
  it('matches the live catalog tile files + background', () => {
    const lib = loadLibrary()
    const entry = lib.themes.gems
    expect(entry).toBeDefined()
    expect(gemsTheme.background).toBe(entry!.background)
    expect(gemsTheme.tiles.map((t) => t.file)).toEqual(entry!.tiles.map((t) => t.file))
    expect(gemsTheme.tiles.map((t) => t.colorId)).toEqual(entry!.tiles.map((t) => t.colorId))
  })

  it('expects the catalog contract: 6 tiles per theme, tile_size 256', () => {
    const lib = loadLibrary()
    expect(lib.tile_size).toBe(256)
    for (const [id, entry] of Object.entries(lib.themes)) {
      expect(entry.tiles, `theme ${id}`).toHaveLength(6)
      entry.tiles.forEach((t, i) => expect(t.colorId, `theme ${id} tile ${i}`).toBe(i))
    }
  })
})
