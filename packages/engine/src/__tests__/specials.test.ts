import { describe, expect, it } from 'vitest'
import {
  type Cell,
  type Coord,
  type EngineEvent,
  type GameDefinition,
  type SpecialKind,
  type SpecialRule,
  type Tile,
  toIndex,
} from '@candylovable/contract'
import { classifyGroup } from '../board'
import { createEngine } from '../engine'
import { makeIdFactory } from '../rng'
import {
  type BlastCtx,
  blastCells,
  chooseAnchor,
  detectActivation,
  mostCommonColor,
  resolveSpecialKind,
} from '../specials'

// --- fixtures --------------------------------------------------------------

const RULES: SpecialRule[] = [
  { match: 'line4', creates: 'striped-h' },
  { match: 'line5', creates: 'colorBomb' },
  { match: 'tShape', creates: 'wrapped' },
  { match: 'lShape', creates: 'wrapped' },
  { match: 'square', creates: 'fish' },
]

const ids = makeIdFactory()
const t = (colorId: number, special: SpecialKind | null = null): Tile => ({
  colorId,
  special,
  id: ids(),
})

const mkDef = (width: number, height: number, board: number[], rules = RULES): GameDefinition => ({
  schemaVersion: 1,
  id: 'specials-test',
  meta: { title: 'S', gameType: 'match3' },
  board: { width, height, cellTypes: Array.from({ length: 6 }, (_, i) => ({ colorId: i })) },
  rules: {
    minMatch: 3,
    allowDiagonal: false,
    specials: rules,
    scoring: {
      baseClear: 60,
      cascadeMultiplier: 'linear',
      specialCreateBonus: { 'striped-h': 120, 'striped-v': 120, wrapped: 200, colorBomb: 200 },
    },
  },
  levels: [{ index: 0, goal: { kind: 'score', target: 1_000_000 }, moveLimit: 50, boardOverride: board }],
  theme: { id: 'x', displayName: 'X', assetBaseUrl: '/assets', background: '', palette: [], tiles: [] },
  audio: { pack: 'default', cues: {} },
  juice: { particles: 0.5, screenShake: 0.5, squashStretch: 0.5, cascadePitch: 0.5, reducedMotionFallback: true },
})

const place = (cells: Cell[], width: number, at: Coord, kind: SpecialKind): void => {
  const tile = cells[toIndex(at.x, at.y, width)]
  if (tile) tile.special = kind
}

const collect = (e: ReturnType<typeof createEngine>): EngineEvent[] => {
  const events: EngineEvent[] = []
  e.onAny((ev) => events.push(ev))
  return events
}

const detonations = (events: EngineEvent[]): Extract<EngineEvent, { type: 'specialDetonate' }>[] =>
  events.filter((e): e is Extract<EngineEvent, { type: 'specialDetonate' }> => e.type === 'specialDetonate')

// --- resolveSpecialKind ----------------------------------------------------

describe('resolveSpecialKind', () => {
  it('maps a horizontal line-4 to striped-h, a vertical line-4 to striped-v', () => {
    const h = classifyGroup([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }], 1)
    const v = classifyGroup([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }], 1)
    expect(resolveSpecialKind(h, RULES)).toBe('striped-h')
    expect(resolveSpecialKind(v, RULES)).toBe('striped-v')
  })

  it('maps a line-5 to colorBomb and a T/L to wrapped', () => {
    const five = classifyGroup(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
      1,
    )
    const tee = classifyGroup(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
      1,
    )
    expect(resolveSpecialKind(five, RULES)).toBe('colorBomb')
    expect(resolveSpecialKind(tee, RULES)).toBe('wrapped')
  })

  it('returns null for a plain 3-line and when no rule matches', () => {
    const three = classifyGroup([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], 1)
    expect(resolveSpecialKind(three, RULES)).toBeNull()
    const four = classifyGroup([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }], 1)
    expect(resolveSpecialKind(four, [])).toBeNull()
  })
})

// --- chooseAnchor ----------------------------------------------------------

describe('chooseAnchor', () => {
  const g = classifyGroup([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }], 1)
  it('prefers the swapped-in cell', () => {
    expect(chooseAnchor(g, 8, { a: { x: 2, y: 0 }, b: { x: 2, y: 1 } })).toEqual({ x: 2, y: 0 })
  })
  it('falls back to the median cell deterministically', () => {
    expect(chooseAnchor(g, 8)).toEqual({ x: 2, y: 0 })
  })
})

// --- blastCells ------------------------------------------------------------

describe('blastCells', () => {
  const mkCtx = (cells: Cell[], width: number, height: number): BlastCtx => ({
    width,
    height,
    cells,
    rng: () => 0,
  })

  it('striped-h clears the full row, striped-v the full column', () => {
    const cells = Array.from({ length: 9 }, () => t(0))
    const ctx = mkCtx(cells, 3, 3)
    expect(blastCells('striped-h', { x: 1, y: 1 }, ctx).map((c) => c.y)).toEqual([1, 1, 1])
    expect(blastCells('striped-v', { x: 1, y: 1 }, ctx).map((c) => c.x)).toEqual([1, 1, 1])
  })

  it('wrapped clears a 3x3, clamped at a corner', () => {
    const cells = Array.from({ length: 9 }, () => t(0))
    const ctx = mkCtx(cells, 3, 3)
    expect(blastCells('wrapped', { x: 1, y: 1 }, ctx)).toHaveLength(9)
    expect(blastCells('wrapped', { x: 0, y: 0 }, ctx)).toHaveLength(4) // corner clamp
  })

  it('colorBomb clears every tile of the most common colour, plus itself', () => {
    // 5 of colour 2, the rest distinct → most common is 2
    const cells = [t(2), t(2), t(2), t(2), t(2), t(1), t(3), t(4), t(0)]
    const ctx = mkCtx(cells, 3, 3)
    const blast = blastCells('colorBomb', { x: 0, y: 2 }, ctx)
    // 5 colour-2 cells + origin
    expect(blast.length).toBe(6)
  })

  it('fish clears its origin plus exactly one sought target', () => {
    const cells = Array.from({ length: 9 }, () => t(0))
    const ctx = mkCtx(cells, 3, 3)
    expect(blastCells('fish', { x: 1, y: 1 }, ctx)).toHaveLength(2)
  })
})

// --- detectActivation ------------------------------------------------------

describe('detectActivation', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 1, y: 0 }
  it('detects bomb + bomb as a whole-board clear', () => {
    expect(detectActivation(t(0, 'colorBomb'), t(1, 'colorBomb'), a, b)).toEqual({
      kind: 'bomb-bomb',
      aAt: a,
      bAt: b,
    })
  })
  it('detects bomb + colour from either side', () => {
    expect(detectActivation(t(0, 'colorBomb'), t(3), a, b)).toMatchObject({ kind: 'bomb-color', color: 3, bombAt: a })
    expect(detectActivation(t(3), t(0, 'colorBomb'), a, b)).toMatchObject({ kind: 'bomb-color', color: 3, bombAt: b })
  })
  it('detects two non-bomb specials as a combo', () => {
    expect(detectActivation(t(0, 'striped-h'), t(1, 'striped-v'), a, b)).toEqual({
      kind: 'special-combo',
      aAt: a,
      bAt: b,
    })
  })
  it('returns null for normal+normal and special+normal', () => {
    expect(detectActivation(t(0), t(1), a, b)).toBeNull()
    expect(detectActivation(t(0, 'striped-h'), t(1), a, b)).toBeNull()
  })
})

describe('mostCommonColor', () => {
  it('ignores colorBombs and returns the dominant colour', () => {
    expect(mostCommonColor([t(1), t(1), t(2), t(0, 'colorBomb')])).toBe(1)
  })
})

// --- engine-level spawn / detonation / activation --------------------------

describe('Engine specials — spawn', () => {
  it('spawns a striped-h from a horizontal line-4 at the swapped cell', () => {
    // row0: 1,1,2,1,3,4 — swapping (2,0)<->(2,1) makes row0 = 1,1,1,1 (a line-4)
    const def = mkDef(6, 3, [
      1, 1, 2, 1, 3, 4,
      5, 0, 1, 5, 0, 2,
      2, 3, 4, 0, 1, 3,
    ])
    const e = createEngine()
    e.init(def, 0)
    const events = collect(e)
    e.trySwap({ x: 2, y: 0 }, { x: 2, y: 1 })

    const m = events.find((ev) => ev.type === 'match')
    expect(m).toMatchObject({ type: 'match', size: 4, shape: 'line' })
    const spawn = events.find((ev) => ev.type === 'spawnSpecial')
    expect(spawn).toEqual({ type: 'spawnSpecial', at: { x: 2, y: 0 }, kind: 'striped-h' })
  })
})

describe('Engine specials — detonation', () => {
  it('detonates a striped tile when it is cleared by a match (clears its column)', () => {
    const def = mkDef(4, 3, [
      1, 1, 3, 4,
      2, 5, 1, 0,
      4, 0, 2, 3,
    ])
    const e = createEngine()
    e.init(def, 0)
    place(e.getState().cells, 4, { x: 2, y: 1 }, 'striped-v') // colour 1, will move into the match
    const events = collect(e)
    e.trySwap({ x: 2, y: 0 }, { x: 2, y: 1 }) // row0 → 1,1,1 including the striped at (2,0)

    const dets = detonations(events)
    expect(dets.some((d) => d.kind === 'striped-v')).toBe(true)
    const stripe = dets.find((d) => d.kind === 'striped-v')
    expect(stripe?.cleared.every((c) => c.x === 2)).toBe(true)
    expect(stripe?.cleared).toHaveLength(3) // full column
  })

  it('chains: a striped blast that hits another special detonates it too', () => {
    const def = mkDef(6, 3, [
      1, 4, 1, 3, 5, 2,
      5, 1, 2, 0, 4, 3,
      2, 3, 4, 1, 0, 5,
    ])
    const e = createEngine()
    e.init(def, 0)
    place(e.getState().cells, 6, { x: 2, y: 0 }, 'striped-h') // colour 1
    place(e.getState().cells, 6, { x: 5, y: 0 }, 'striped-v') // colour 2, in striped-h's row
    const events = collect(e)
    e.trySwap({ x: 1, y: 0 }, { x: 1, y: 1 }) // row0 → 1,1,1 (incl. the striped-h at (2,0))

    const dets = detonations(events)
    const kinds = dets.map((d) => d.kind)
    expect(kinds).toContain('striped-h')
    expect(kinds).toContain('striped-v') // chained off the row blast
  })
})

describe('Engine specials — activation swaps', () => {
  it('colorBomb + normal clears every tile of that colour', () => {
    const def = mkDef(4, 3, [
      5, 2, 3, 2,
      0, 9, 1, 2, // (1,1) becomes a colorBomb (its colorId is irrelevant)
      2, 4, 2, 0,
    ])
    const e = createEngine()
    e.init(def, 0)
    place(e.getState().cells, 4, { x: 1, y: 1 }, 'colorBomb')
    const events = collect(e)
    const res = e.trySwap({ x: 1, y: 1 }, { x: 1, y: 0 }) // swap bomb with a colour-2 tile

    expect(res).toEqual({ accepted: true })
    const det = detonations(events).find((d) => d.kind === 'colorBomb')
    expect(det).toBeDefined()
    // five colour-2 tiles + the bomb cell
    expect(det?.cleared).toHaveLength(6)
  })

  it('colorBomb + colorBomb clears the whole board', () => {
    const def = mkDef(4, 3, [
      5, 2, 3, 4,
      0, 9, 9, 1,
      2, 4, 1, 0,
    ])
    const e = createEngine()
    e.init(def, 0)
    place(e.getState().cells, 4, { x: 1, y: 1 }, 'colorBomb')
    place(e.getState().cells, 4, { x: 2, y: 1 }, 'colorBomb')
    const events = collect(e)
    e.trySwap({ x: 1, y: 1 }, { x: 2, y: 1 })

    const det = detonations(events).find((d) => d.kind === 'colorBomb')
    expect(det?.cleared).toHaveLength(12) // every cell
  })

  it('two stripes combo into a row + column detonation', () => {
    const def = mkDef(4, 3, [
      5, 2, 3, 4,
      0, 1, 2, 1,
      2, 4, 1, 0,
    ])
    const e = createEngine()
    e.init(def, 0)
    place(e.getState().cells, 4, { x: 1, y: 1 }, 'striped-h')
    place(e.getState().cells, 4, { x: 2, y: 1 }, 'striped-v')
    const events = collect(e)
    e.trySwap({ x: 1, y: 1 }, { x: 2, y: 1 })

    const kinds = detonations(events).map((d) => d.kind)
    expect(kinds).toContain('striped-h')
    expect(kinds).toContain('striped-v')
  })
})
