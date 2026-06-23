import type { GameDefinition } from '@candylovable/contract'
import { GAME_TYPES, SPECIAL_KINDS } from '@candylovable/contract'
import type { AssetCatalog } from '../assets/catalog'

export interface ValidationError {
  path: string
  message: string
}

/**
 * The Opus-level gate (PRD §7): deterministic schema + semantic checks the weak model's
 * output must pass. Returns the full error list (not throw-on-first) so the repair loop can
 * fix everything in one round. Semantic solvability lives in `simulate-level`; asset-theme
 * existence is checked here when a catalog is supplied (anti-hallucination).
 */
export function validateGame(def: GameDefinition, catalog?: AssetCatalog): ValidationError[] {
  const errors: ValidationError[] = []
  const err = (path: string, message: string): void => {
    errors.push({ path, message })
  }

  if (!GAME_TYPES.includes(def.meta.gameType)) err('meta.gameType', `unknown gameType "${def.meta.gameType}"`)

  const { width, height, cellTypes } = def.board
  if (width <= 0 || height <= 0) err('board', `width/height must be > 0 (got ${width}x${height})`)
  if (cellTypes.length !== 6) err('board.cellTypes', `expected 6 tile colors, got ${cellTypes.length}`)
  const colorIds = cellTypes.map((c) => c.colorId).sort((a, b) => a - b)
  if (colorIds.join(',') !== '0,1,2,3,4,5') err('board.cellTypes', `colorIds must be exactly 0..5, got [${colorIds.join(',')}]`)

  if (def.rules.minMatch < 3) err('rules.minMatch', `must be >= 3, got ${def.rules.minMatch}`)
  def.rules.specials.forEach((s, i) => {
    if (!SPECIAL_KINDS.includes(s.creates)) err(`rules.specials[${i}].creates`, `unknown special "${s.creates}"`)
  })
  if (def.rules.scoring.baseClear <= 0) err('rules.scoring.baseClear', 'must be > 0')

  def.levels.forEach((lvl, i) => {
    const lp = `levels[${i}]`
    if (lvl.index !== i) err(`${lp}.index`, `must be contiguous from 0 (got ${lvl.index} at position ${i})`)
    if (lvl.moveLimit !== undefined && lvl.moveLimit <= 0) err(`${lp}.moveLimit`, 'must be > 0')
    if (lvl.boardOverride && lvl.boardOverride.length !== width * height) {
      err(`${lp}.boardOverride`, `length ${lvl.boardOverride.length} != width*height ${width * height}`)
    }
    const stars = lvl.stars
    if (stars && !(stars[0] < stars[1] && stars[1] < stars[2])) {
      err(`${lp}.stars`, `must be strictly increasing, got [${stars.join(',')}]`)
    }

    const goal = lvl.goal
    if (goal.kind === 'score' && stars && stars[0] !== goal.target) {
      err(`${lp}.stars`, `1-star (${stars[0]}) must equal the score goal target (${goal.target})`)
    }
    if (goal.kind === 'collect') {
      if (goal.collectColorId === undefined) err(`${lp}.goal`, 'collect goal needs collectColorId')
      else if (goal.collectColorId < 0 || goal.collectColorId > 5) err(`${lp}.goal.collectColorId`, 'must be 0..5')
    }
    if (goal.kind === 'clearJelly') {
      const jelly = (lvl.blockers ?? []).filter((b) => b.kind === 'jelly').length
      if (jelly !== goal.target) err(`${lp}.goal`, `clearJelly target ${goal.target} != jelly blocker count ${jelly}`)
    }
    ;(lvl.blockers ?? []).forEach((b, bi) => {
      if (b.at.x < 0 || b.at.x >= width || b.at.y < 0 || b.at.y >= height) {
        err(`${lp}.blockers[${bi}]`, `out of bounds (${b.at.x},${b.at.y}) on ${width}x${height}`)
      }
    })
  })

  if (catalog && !catalog.hasTheme(def.theme.id)) {
    err('theme.id', `theme "${def.theme.id}" is not in the asset library`)
  }

  return errors
}
