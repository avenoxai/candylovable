import type { GameDefinition } from '@candylovable/contract'
import { FakeEngine } from '@candylovable/mocks'
import referenceJson from './reference.gamedef.json'

/**
 * The benchmark reference — echo's quality bar for the fixed prompt
 * (`loop/deepseek-infra/benchmark/`). Carried here as the package's test fixture so the
 * eval/P0 checkpoint is self-contained. Keep in sync with the canonical copy in `loop/`.
 */
export const reference = referenceJson as unknown as GameDefinition

export interface LevelSolvability {
  levelIndex: number
  availableMoves: number
  solvableStart: boolean
}

/**
 * Run each level's initial board through the reference engine (`@candylovable/mocks`) and
 * confirm at least one legal move exists from the start — the floor of "solvable". The real
 * engine swaps in later behind the same `EngineInstance` interface.
 */
export function checkSolvable(def: GameDefinition): LevelSolvability[] {
  return def.levels.map((lvl) => {
    const engine = new FakeEngine()
    engine.init(def, lvl.index)
    const availableMoves = engine.getAvailableMoves().length
    return { levelIndex: lvl.index, availableMoves, solvableStart: availableMoves > 0 }
  })
}
