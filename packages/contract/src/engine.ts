import type { Coord } from './coord'
import type { GameDefinition, Goal, SpecialKind } from './game-definition'

export interface Tile {
  colorId: number
  special: SpecialKind | null
  /** Stable id so the renderer can track a tile across gravity/refill. */
  id: number
}
export type Cell = Tile | null

export interface GameState {
  width: number
  height: number
  /** Flat board, `idx = x + y * width`. */
  cells: Cell[]
  score: number
  movesUsed: number
  moveLimit?: number
  goal: Goal
  goalProgress: number
  status: 'playing' | 'won' | 'lost'
  levelIndex: number
}

export interface Move {
  a: Coord
  b: Coord
}

export type MoveResult =
  | { accepted: true }
  | { accepted: false; reason: 'no-match' | 'not-adjacent' | 'busy' | 'out-of-bounds' }

/**
 * Semantic events the engine emits. The renderer (FE) turns each of these into
 * juice — engine never knows about animation. This split IS the FE/BE boundary.
 */
export type EngineEvent =
  | { type: 'swap'; a: Coord; b: Coord; accepted: boolean }
  | { type: 'match'; cells: Coord[]; shape: 'line' | 'L' | 'T' | 'square'; size: number }
  | { type: 'clear'; cells: Coord[]; cascadeLevel: number }
  | { type: 'gravity'; moves: { from: Coord; to: Coord }[] }
  | { type: 'refill'; cells: { at: Coord; tile: Tile }[] }
  | { type: 'spawnSpecial'; at: Coord; kind: SpecialKind }
  | { type: 'specialDetonate'; origin: Coord; cleared: Coord[]; kind: SpecialKind }
  | { type: 'score'; delta: number; total: number; at?: Coord; cascadeLevel: number }
  | { type: 'goalProgress'; goal: Goal; current: number; target: number }
  | { type: 'shuffle'; reason: 'no-moves' }
  | { type: 'win'; stars: number; score: number }
  | { type: 'lose'; reason: 'out-of-moves'; shortBy?: number }
  | { type: 'nearMiss'; shortBy: number }

export type EngineEventType = EngineEvent['type']

/** Narrow an {@link EngineEvent} union member by its `type`. */
export type EngineEventOf<T extends EngineEventType> = Extract<EngineEvent, { type: T }>

export type Unsubscribe = () => void

/** Headless game core. Implemented by the system agent under `engine/`. */
export interface EngineInstance {
  init(def: GameDefinition, levelIndex: number): GameState
  getState(): GameState
  trySwap(a: Coord, b: Coord): MoveResult
  getHint(): Move | null
  getAvailableMoves(): Move[]
  reset(): void
  /** Subscribe to a single event type. */
  on<T extends EngineEventType>(type: T, cb: (e: EngineEventOf<T>) => void): Unsubscribe
  /** Subscribe to every event in emission order. */
  onAny(cb: (e: EngineEvent) => void): Unsubscribe
}
