import type { GameDefinition } from '@candylovable/contract'
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

  const errors = validateGame(def, catalog)
  return errors.length > 0 ? { errors } : { def, errors: [] }
}
