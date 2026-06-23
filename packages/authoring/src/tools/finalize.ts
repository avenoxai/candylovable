import type { Blocker, GameDefinition } from '@candylovable/contract'
import type { AssetCatalog } from '../assets/catalog'
import type { ValidationError } from '../validate/validate-game'
import { validateGame } from '../validate/validate-game'
import type { DraftState } from './types'

export interface AssembleResult {
  def?: GameDefinition
  errors: ValidationError[]
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'game'

/**
 * Turn the assembled draft into a full {@link GameDefinition}, then run the validation gate.
 * Missing required sections are reported as errors (so finalize never emits a half-built
 * game). `audio` defaults to an empty pack — the assets/visual lane hasn't produced audio
 * yet, and a game is valid without cues.
 */
export function assembleDraft(draft: DraftState, catalog?: AssetCatalog): AssembleResult {
  const d = draft.def
  const missing: ValidationError[] = []
  if (!d.meta) missing.push({ path: 'meta', message: 'missing — call set_meta' })
  if (!d.board) missing.push({ path: 'board', message: 'missing — call set_board' })
  if (!d.rules) missing.push({ path: 'rules', message: 'missing — call set_rules' })
  if (!d.theme) missing.push({ path: 'theme', message: 'missing — call select_theme' })
  if (!d.juice) missing.push({ path: 'juice', message: 'missing — call set_juice' })
  if (!d.levels || d.levels.length === 0) missing.push({ path: 'levels', message: 'no levels — call author_level' })
  if (missing.length > 0) return { errors: missing }

  const def: GameDefinition = {
    schemaVersion: 1,
    id: slug(d.meta!.title),
    meta: d.meta!,
    board: d.board!,
    rules: d.rules!,
    levels: d.levels!,
    theme: d.theme!,
    audio: d.audio ?? { pack: d.theme!.id, cues: {} },
    juice: d.juice!,
  }

  normalizeGame(def)
  const errors = validateGame(def, catalog)
  return errors.length > 0 ? { errors } : { def, errors: [] }
}

/**
 * Infra-does-the-work: fix the deterministic, mechanical invariants the (weak) model
 * shouldn't have to nail by hand — so it can focus on DESIGN (curve, goals, juice) while we
 * guarantee consistency. We only normalise things with one correct answer; we never invent
 * difficulty or solvability (those stay the model's job and are graded by the rubric).
 */
function normalizeGame(def: GameDefinition): void {
  const { width, height } = def.board
  def.levels.forEach((lvl, i) => {
    lvl.index = i // contiguous from 0
    if (lvl.goal.kind === 'score' && lvl.stars) lvl.stars[0] = lvl.goal.target // 1-star == score target
    if (lvl.goal.kind === 'clearJelly') {
      // The model asked for a jelly level but may not have placed (enough) jelly. Materialise
      // its intent: auto-place jelly blockers to match the target, then align the count.
      const blockers = lvl.blockers ?? []
      const jellyCount = blockers.filter((b) => b.kind === 'jelly').length
      const target = lvl.goal.target > 0 ? lvl.goal.target : 9
      if (jellyCount < target) {
        const occupied = new Set(blockers.map((b) => `${b.at.x},${b.at.y}`))
        const added: Blocker[] = []
        for (let cell = 0; cell < width * height && jellyCount + added.length < target; cell++) {
          const x = cell % width
          const y = Math.floor(cell / width)
          if (!occupied.has(`${x},${y}`)) {
            added.push({ at: { x, y }, kind: 'jelly', layers: 1 })
            occupied.add(`${x},${y}`)
          }
        }
        lvl.blockers = [...blockers, ...added]
        lvl.goal.target = jellyCount + added.length
      } else {
        lvl.goal.target = jellyCount
      }
    }
    if (lvl.stars) {
      if (lvl.stars[1] <= lvl.stars[0]) lvl.stars[1] = lvl.stars[0] + 1
      if (lvl.stars[2] <= lvl.stars[1]) lvl.stars[2] = lvl.stars[1] + 1
    }
  })
}
