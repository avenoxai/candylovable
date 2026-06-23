import type { GameDefinition } from '@candylovable/contract'
import { describe, expect, it } from 'vitest'
import { AssetCatalog, type LibraryJson } from '../assets/catalog'
import { reference } from '../eval/load'
import { validateGame } from './validate-game'

const clone = (): GameDefinition => structuredClone(reference)

describe('validateGame', () => {
  it('passes the benchmark reference with zero errors', () => {
    expect(validateGame(reference)).toEqual([])
  })

  it('flags a board that is not exactly 6 colorIds', () => {
    const d = clone()
    d.board.cellTypes.pop()
    expect(validateGame(d).some((e) => e.path === 'board.cellTypes')).toBe(true)
  })

  it('flags minMatch < 3', () => {
    const d = clone()
    d.rules.minMatch = 2
    expect(validateGame(d).some((e) => e.path === 'rules.minMatch')).toBe(true)
  })

  it('flags non-monotonic stars', () => {
    const d = clone()
    d.levels[0]!.stars = [3000, 1000, 5000]
    expect(validateGame(d).some((e) => e.path.endsWith('.stars'))).toBe(true)
  })

  it('flags a score 1-star that does not equal the goal target', () => {
    const d = clone()
    const lvl = d.levels[0]!
    if (lvl.goal.kind === 'score' && lvl.stars) lvl.stars[0] = lvl.goal.target + 999
    expect(validateGame(d).some((e) => e.message.includes('1-star'))).toBe(true)
  })

  it('flags a clearJelly target that does not match the jelly blocker count', () => {
    const d = clone()
    const jellyLvl = d.levels.find((l) => l.goal.kind === 'clearJelly')!
    jellyLvl.goal.target = 999
    expect(validateGame(d).some((e) => e.message.includes('clearJelly'))).toBe(true)
  })

  it('flags an out-of-bounds blocker', () => {
    const d = clone()
    const lvl = d.levels.find((l) => l.blockers && l.blockers.length > 0)!
    lvl.blockers![0]!.at = { x: 999, y: 0 }
    expect(validateGame(d).some((e) => e.message.includes('out of bounds'))).toBe(true)
  })

  it('flags non-contiguous level indices', () => {
    const d = clone()
    d.levels[1]!.index = 7
    expect(validateGame(d).some((e) => e.path.endsWith('.index'))).toBe(true)
  })

  it('rejects a theme that is not in the asset library (anti-hallucination)', () => {
    const lib: LibraryJson = {
      version: 1,
      tile_size: 256,
      kind: 'whole_sprite',
      themes: { gems: { background: { file: 'x', description: '' }, tiles: [] } },
      shared: { overlay: [], blocker: [], texture_9slice: [], particle: [] },
    }
    const errors = validateGame(reference, new AssetCatalog(lib))
    expect(errors.some((e) => e.path === 'theme.id')).toBe(true)
  })
})
