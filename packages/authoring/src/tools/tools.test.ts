import type { GameDefinition } from '@candylovable/contract'
import { describe, expect, it } from 'vitest'
import { AssetCatalog, type LibraryJson } from '../assets/catalog'
import { validateGame } from '../validate/validate-game'
import { buildToolRegistry } from './tools'
import { type ToolContext, type ToolResult, newDraft } from './types'

function candyCatalog(): AssetCatalog {
  const tiles = Array.from({ length: 6 }, (_unused, i) => ({
    colorId: i,
    file: `themes/candy/tile_candy_0${i}.png`,
    description: `candy tile ${i}`,
  }))
  const lib: LibraryJson = {
    version: 1,
    tile_size: 256,
    kind: 'whole_sprite',
    themes: { candy: { background: { file: 'themes/candy/bg_candy.png', description: 'bg' }, tiles } },
    shared: {
      overlay: [{ name: 'fx_special_striped', file: 'shared/fx_special_striped.png', description: 's' }],
      blocker: [],
      texture_9slice: [],
      particle: [],
    },
  }
  return new AssetCatalog(lib)
}

function freshCtx(): { ctx: ToolContext; call: (name: string, args?: Record<string, unknown>) => ToolResult } {
  const ctx: ToolContext = { draft: newDraft(), catalog: candyCatalog() }
  const { tools } = buildToolRegistry()
  const call = (name: string, args: Record<string, unknown> = {}): ToolResult => tools.get(name)!.handler(args, ctx)
  return { ctx, call }
}

describe('tool registry', () => {
  it('exposes 15 tools in a stable order', () => {
    const { defs } = buildToolRegistry()
    expect(defs).toHaveLength(15)
    expect(defs[0]!.name).toBe('propose_design_directions')
    expect(defs.at(-1)!.name).toBe('finalize')
  })
})

describe('the build path produces a valid game', () => {
  it('select → meta → board → rules → level → juice → finalize', () => {
    const { ctx, call } = freshCtx()
    expect(call('select_theme', { theme: 'candy' }).ok).toBe(true)
    expect(call('set_meta', { title: 'Test Game', gameType: 'match3' }).ok).toBe(true)
    expect(call('set_board', { width: 8, height: 8 }).ok).toBe(true)
    expect(call('set_rules', { minMatch: 3, specials: [{ match: 'line4', creates: 'striped-h' }], scoring: { baseClear: 60 } }).ok).toBe(true)
    expect(call('author_level', { index: 0, goal: { kind: 'score', target: 1500 }, moveLimit: 25, stars: [1500, 3000, 4500] }).ok).toBe(true)
    expect(call('set_juice', { particles: 0.7 }).ok).toBe(true)

    const res = call('finalize')
    expect(res.ok).toBe(true)
    if (res.ok) {
      const def = res.data as GameDefinition
      expect(validateGame(def, ctx.catalog)).toEqual([])
      expect(def.theme.id).toBe('candy')
      expect(def.board.cellTypes).toHaveLength(6)
      expect(def.juice.reducedMotionFallback).toBe(true)
    }
  })
})

describe('tool guards (every invalid path fails loudly)', () => {
  it('select_theme rejects a theme not in the library', () => {
    const { call } = freshCtx()
    expect(call('select_theme', { theme: 'dragons' }).ok).toBe(false)
  })

  it('validate_asset_refs rejects an invented ref but passes a real one', () => {
    const { call } = freshCtx()
    expect(call('validate_asset_refs', { refs: ['fx_special_striped'] }).ok).toBe(true)
    expect(call('validate_asset_refs', { refs: ['made_up.png'] }).ok).toBe(false)
  })

  it('set_meta rejects an unknown gameType', () => {
    const { call } = freshCtx()
    expect(call('set_meta', { title: 'x', gameType: 'shooter' }).ok).toBe(false)
  })

  it('author_level requires index and goal', () => {
    const { call } = freshCtx()
    expect(call('author_level', { index: 0 }).ok).toBe(false)
  })

  it('simulate_level needs a board + level first, then confirms solvable', () => {
    const { call } = freshCtx()
    expect(call('simulate_level', { index: 0 }).ok).toBe(false)
    call('select_theme', { theme: 'candy' })
    call('set_board', { width: 8, height: 8 })
    call('author_level', { index: 0, goal: { kind: 'score', target: 1000 } })
    expect(call('simulate_level', { index: 0 }).ok).toBe(true)
  })

  it('finalize on an empty draft reports the missing sections', () => {
    const { call } = freshCtx()
    const res = call('finalize')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors.join(' ')).toMatch(/meta|board|rules|theme|juice|levels/)
  })
})
