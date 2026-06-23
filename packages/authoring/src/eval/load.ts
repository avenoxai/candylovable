import type { GameDefinition } from '@candylovable/contract'
import { type LevelSim, simulateAll } from '../validate/simulate-level'
import referenceJson from './reference.gamedef.json'

/**
 * The benchmark reference — echo's quality bar for the fixed prompt
 * (`loop/deepseek-infra/benchmark/`). Carried here as the package's test fixture so the
 * eval/P0 checkpoint is self-contained. Keep in sync with the canonical copy in `loop/`.
 */
export const reference = referenceJson as unknown as GameDefinition

export type LevelSolvability = LevelSim

/** Confirm every level starts from a solvable board (delegates to the engine adapter). */
export function checkSolvable(def: GameDefinition): LevelSolvability[] {
  return simulateAll(def)
}
