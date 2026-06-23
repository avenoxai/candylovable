import type { EngineInstance, GameDefinition } from '@candylovable/contract'
import { FakeEngine } from '@candylovable/mocks'

/** Produces a fresh engine. Defaults to the mocks reference; backend's real engine swaps in here. */
export type EngineFactory = () => EngineInstance

export interface LevelSim {
  levelIndex: number
  availableMoves: number
  /** The floor of "solvable": at least one legal move exists from the initial board. */
  solvableStart: boolean
}

/**
 * Run one level's initial board through an engine and report whether a move exists. Semantic
 * solvability/star-derivation beyond this is delegated to the engine lane (PRD §7); P2 ships
 * the start-state floor, which is enough to catch a dead board.
 */
export function simulateLevel(
  def: GameDefinition,
  levelIndex: number,
  makeEngine: EngineFactory = () => new FakeEngine(),
): LevelSim {
  const engine = makeEngine()
  engine.init(def, levelIndex)
  const availableMoves = engine.getAvailableMoves().length
  return { levelIndex, availableMoves, solvableStart: availableMoves > 0 }
}

export function simulateAll(def: GameDefinition, makeEngine?: EngineFactory): LevelSim[] {
  return def.levels.map((lvl) => simulateLevel(def, lvl.index, makeEngine))
}
