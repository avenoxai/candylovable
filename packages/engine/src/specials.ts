import {
  type Cell,
  type Coord,
  type SpecialKind,
  type SpecialRule,
  coordKey,
  toIndex,
} from '@candylovable/contract'
import type { MatchGroup } from './board'
import { type Rng, randInt } from './rng'

/** Recover a Coord from a `coordKey` ("x,y"). */
export const unkey = (k: string): Coord => {
  const i = k.indexOf(',')
  return { x: Number(k.slice(0, i)), y: Number(k.slice(i + 1)) }
}

export { coordKey }

/**
 * Which special (if any) a matched group spawns, given the def's SpecialRules.
 * The match descriptor is derived from the group's shape/run; striped orientation
 * is derived from the run AXIS (horizontal run → striped-h clears the row; vertical
 * → striped-v clears the column), regardless of which striped the rule names.
 */
export const resolveSpecialKind = (g: MatchGroup, rules: SpecialRule[]): SpecialKind | null => {
  let match: SpecialRule['match'] | null = null
  if (g.shape === 'line') {
    if (g.maxRun >= 5) match = 'line5'
    else if (g.maxRun === 4) match = 'line4'
  } else if (g.shape === 'square') {
    match = 'square'
  } else if (g.shape === 'T') {
    match = 'tShape'
  } else if (g.shape === 'L') {
    match = 'lShape'
  }
  if (!match) return null
  const rule = rules.find((r) => r.match === match)
  if (!rule) return null
  if (rule.creates === 'striped-h' || rule.creates === 'striped-v') {
    const y0 = (g.cells[0] as Coord).y
    const horizontal = g.cells.every((c) => c.y === y0)
    return horizontal ? 'striped-h' : 'striped-v'
  }
  return rule.creates
}

/** Where the spawned special lands: the swapped-in cell if it's in the group, else the median. */
export const chooseAnchor = (
  g: MatchGroup,
  width: number,
  lastSwap?: { a: Coord; b: Coord },
): Coord => {
  if (lastSwap) {
    const hit = g.cells.find(
      (c) =>
        (c.x === lastSwap.a.x && c.y === lastSwap.a.y) ||
        (c.x === lastSwap.b.x && c.y === lastSwap.b.y),
    )
    if (hit) return hit
  }
  const sorted = [...g.cells].sort(
    (p, q) => toIndex(p.x, p.y, width) - toIndex(q.x, q.y, width),
  )
  return sorted[Math.floor(sorted.length / 2)] as Coord
}

/** The most common (match-eligible) colour on the board — colorBomb's default target. */
export const mostCommonColor = (cells: Cell[]): number => {
  const counts = new Map<number, number>()
  for (const c of cells) {
    if (c && c.special !== 'colorBomb') counts.set(c.colorId, (counts.get(c.colorId) ?? 0) + 1)
  }
  let best = 0
  let bestN = -1
  for (const [color, n] of counts) {
    if (n > bestN) {
      bestN = n
      best = color
    }
  }
  return best
}

export interface BlastCtx {
  width: number
  height: number
  cells: Cell[]
  rng: Rng
}

/**
 * The set of cells a detonating special destroys (its "cells-destroyed function").
 * Fed back into the cascade loop so combos + chain detonations fall out naturally
 * (CLAUDE.md engine reference). striped = full row/column, wrapped = 3x3, colorBomb =
 * every tile of the board's most-common colour, fish = origin + one sought target.
 */
export const blastCells = (kind: SpecialKind, origin: Coord, ctx: BlastCtx): Coord[] => {
  const { width, height, cells } = ctx
  const out: Coord[] = []
  if (kind === 'striped-h') {
    for (let x = 0; x < width; x++) out.push({ x, y: origin.y })
  } else if (kind === 'striped-v') {
    for (let y = 0; y < height; y++) out.push({ x: origin.x, y })
  } else if (kind === 'wrapped') {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = origin.x + dx
        const y = origin.y + dy
        if (x >= 0 && x < width && y >= 0 && y < height) out.push({ x, y })
      }
    }
  } else if (kind === 'colorBomb') {
    const color = mostCommonColor(cells)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = cells[toIndex(x, y, width)]
        if (c && c.special !== 'colorBomb' && c.colorId === color) out.push({ x, y })
      }
    }
    out.push(origin)
  } else if (kind === 'fish') {
    out.push(origin)
    const targets: Coord[] = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if ((x !== origin.x || y !== origin.y) && cells[toIndex(x, y, width)]) {
          targets.push({ x, y })
        }
      }
    }
    if (targets.length) out.push(targets[randInt(ctx.rng, targets.length)] as Coord)
  }
  return out
}

/** A swap that activates specials directly (no normal 3-match required). */
export type Activation =
  | { kind: 'bomb-bomb'; aAt: Coord; bAt: Coord }
  | { kind: 'bomb-color'; bombAt: Coord; color: number; otherAt: Coord }
  | { kind: 'special-combo'; aAt: Coord; bAt: Coord }

/**
 * Classify a swap by the specials involved:
 * - colorBomb + colorBomb → clears the whole board;
 * - colorBomb + anything → clears every tile of the other tile's colour;
 * - two non-bomb specials → a combo (each detonates → plus/cross/etc.);
 * - otherwise null (fall back to the normal match path).
 */
export const detectActivation = (ta: Cell, tb: Cell, a: Coord, b: Coord): Activation | null => {
  const sa = ta?.special ?? null
  const sb = tb?.special ?? null
  if (sa === 'colorBomb' && sb === 'colorBomb') return { kind: 'bomb-bomb', aAt: a, bAt: b }
  if (sa === 'colorBomb' && tb) return { kind: 'bomb-color', bombAt: a, color: tb.colorId, otherAt: b }
  if (sb === 'colorBomb' && ta) return { kind: 'bomb-color', bombAt: b, color: ta.colorId, otherAt: a }
  if (sa !== null && sb !== null) return { kind: 'special-combo', aAt: a, bAt: b }
  return null
}
