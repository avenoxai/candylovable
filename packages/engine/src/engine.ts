import {
  type Cell,
  type Coord,
  type EngineEvent,
  type EngineEventOf,
  type EngineEventType,
  type EngineInstance,
  type GameDefinition,
  type GameState,
  type Move,
  type MoveResult,
  type Unsubscribe,
  isAdjacent,
  toIndex,
} from '@candylovable/contract'
import {
  applyGravity,
  clearCells,
  findMatches,
  generateBoard,
  refill,
} from './board'
import { hashString, makeIdFactory, mulberry32, type Rng } from './rng'
import { findAvailableMoves, hasAvailableMove, shuffleBoard } from './solver'

/** Seed derivation shared with the FakeEngine so identical defs produce identical boards. */
export const seedFor = (gameId: string, levelIndex: number): number =>
  hashString(gameId) ^ ((levelIndex + 1) * 0x9e3779b1)

/**
 * The production headless match-3 core. Implements {@link EngineInstance} and emits
 * the same semantic {@link EngineEvent}s — in the same order — as the FE's
 * `@candylovable/mocks` `FakeEngine`, so it is a drop-in for the renderer (BE-D5).
 *
 * P1 covers the canonical cascade (match → clear → score → gravity → refill) +
 * score/collect goals + win/lose/near-miss + dead-board shuffle. Special-tile
 * spawning + detonation chains are layered on in P2 *without* changing this event
 * order (a def with `rules.specials: []` keeps clear-all parity).
 */
export class Engine implements EngineInstance {
  private def!: GameDefinition
  private state!: GameState
  private rng: Rng = mulberry32(1)
  private nextId = makeIdFactory()
  private readonly listeners = new Map<EngineEventType, Set<(e: EngineEvent) => void>>()
  private readonly anyListeners = new Set<(e: EngineEvent) => void>()

  init(def: GameDefinition, levelIndex: number): GameState {
    const level = def.levels[levelIndex]
    if (!level) throw new Error(`level ${levelIndex} not found`)
    this.def = def
    this.rng = mulberry32(seedFor(def.id, levelIndex))
    this.nextId = makeIdFactory()

    const { width, height } = def.board
    const colorCount = def.board.cellTypes.length
    let cells: Cell[]
    if (level.boardOverride) {
      cells = level.boardOverride.map((c) =>
        c === null ? null : { colorId: c, special: null, id: this.nextId() },
      )
      this.settleSilently(cells, width, height, colorCount)
    } else {
      cells = generateBoard(width, height, colorCount, this.rng, this.nextId)
    }

    const initial: GameState = {
      width,
      height,
      cells,
      score: 0,
      movesUsed: 0,
      goal: level.goal,
      goalProgress: 0,
      status: 'playing',
      levelIndex,
    }
    if (level.moveLimit !== undefined) initial.moveLimit = level.moveLimit
    this.state = initial
    return this.state
  }

  getState(): GameState {
    return this.state
  }

  reset(): void {
    this.init(this.def, this.state.levelIndex)
  }

  on<T extends EngineEventType>(type: T, cb: (e: EngineEventOf<T>) => void): Unsubscribe {
    const set = this.listeners.get(type) ?? new Set()
    set.add(cb as (e: EngineEvent) => void)
    this.listeners.set(type, set)
    return () => set.delete(cb as (e: EngineEvent) => void)
  }

  onAny(cb: (e: EngineEvent) => void): Unsubscribe {
    this.anyListeners.add(cb)
    return () => this.anyListeners.delete(cb)
  }

  private emit(e: EngineEvent): void {
    this.listeners.get(e.type)?.forEach((cb) => cb(e))
    this.anyListeners.forEach((cb) => cb(e))
  }

  getAvailableMoves(): Move[] {
    const { cells, width, height } = this.state
    return findAvailableMoves(cells, width, height, this.def.rules.minMatch).map((m) => ({
      a: m.a,
      b: m.b,
    }))
  }

  getHint(): Move | null {
    return this.getAvailableMoves()[0] ?? null
  }

  trySwap(a: Coord, b: Coord): MoveResult {
    if (this.state.status !== 'playing') return { accepted: false, reason: 'busy' }
    const { cells, width, height } = this.state
    if (!this.inBounds(a) || !this.inBounds(b)) return { accepted: false, reason: 'out-of-bounds' }
    if (!isAdjacent(a, b)) return { accepted: false, reason: 'not-adjacent' }

    const minMatch = this.def.rules.minMatch
    this.swapCells(cells, a, b)
    if (findMatches(cells, width, height, minMatch).length === 0) {
      this.swapCells(cells, a, b)
      this.emit({ type: 'swap', a, b, accepted: false })
      return { accepted: false, reason: 'no-match' }
    }

    this.emit({ type: 'swap', a, b, accepted: true })
    this.state.movesUsed++
    this.resolveCascades()
    this.evaluateGoalAndEnd()
    return { accepted: true }
  }

  // --- internals -----------------------------------------------------------

  private inBounds(c: Coord): boolean {
    return c.x >= 0 && c.x < this.state.width && c.y >= 0 && c.y < this.state.height
  }

  private swapCells(cells: Cell[], a: Coord, b: Coord): void {
    const ia = toIndex(a.x, a.y, this.state.width)
    const ib = toIndex(b.x, b.y, this.state.width)
    const tmp = cells[ia] as Cell
    cells[ia] = cells[ib] as Cell
    cells[ib] = tmp
  }

  private multiplier(cascadeLevel: number): number {
    const m = this.def.rules.scoring.cascadeMultiplier
    if (m === 'linear') return cascadeLevel
    if (m === 'factorial') return 2 ** (cascadeLevel - 1)
    return m ** (cascadeLevel - 1)
  }

  /** The cascade loop. Emits semantic events; the renderer turns them into juice. */
  private resolveCascades(): void {
    const { width, height } = this.state
    const cells = this.state.cells
    const minMatch = this.def.rules.minMatch
    const colorCount = this.def.board.cellTypes.length
    const base = this.def.rules.scoring.baseClear
    let cascadeLevel = 0

    for (;;) {
      const groups = findMatches(cells, width, height, minMatch)
      if (groups.length === 0) break
      cascadeLevel++

      const cleared: Coord[] = []
      for (const g of groups) {
        this.emit({ type: 'match', cells: g.cells, shape: g.shape, size: g.size })
        cleared.push(...g.cells)
      }
      this.emit({ type: 'clear', cells: cleared, cascadeLevel })

      const delta = Math.round(cleared.length * base * this.multiplier(cascadeLevel))
      this.state.score += delta
      this.emit({ type: 'score', delta, total: this.state.score, cascadeLevel })
      this.trackGoalProgress(cleared)

      clearCells(cells, cleared, width)
      const moves = applyGravity(cells, width, height)
      if (moves.length) this.emit({ type: 'gravity', moves })
      const added = refill(cells, width, height, colorCount, this.rng, this.nextId)
      if (added.length) this.emit({ type: 'refill', cells: added })
    }
  }

  private trackGoalProgress(cleared: Coord[]): void {
    const goal = this.state.goal
    if (goal.kind === 'score') {
      this.state.goalProgress = this.state.score
    } else if (goal.kind === 'collect' && goal.collectColorId !== undefined) {
      const { cells, width } = this.state
      const n = cleared.filter(
        (c) => cells[toIndex(c.x, c.y, width)]?.colorId === goal.collectColorId,
      ).length
      this.state.goalProgress += n
    } else {
      this.state.goalProgress += cleared.length
    }
  }

  private evaluateGoalAndEnd(): void {
    const { goal, width, height, cells } = this.state
    const minMatch = this.def.rules.minMatch
    const target = goal.target
    const current = this.state.goalProgress
    this.emit({ type: 'goalProgress', goal, current, target })

    const met = goal.kind === 'score' ? this.state.score >= target : current >= target
    if (met) {
      this.state.status = 'won'
      const stars = this.starsFor(this.state.score)
      this.emit({ type: 'win', stars, score: this.state.score })
      return
    }

    const limit = this.state.moveLimit
    if (limit !== undefined && this.state.movesUsed >= limit) {
      this.state.status = 'lost'
      if (target > 0 && current >= target * 0.85) {
        this.emit({ type: 'nearMiss', shortBy: 1 })
        this.emit({ type: 'lose', reason: 'out-of-moves', shortBy: 1 })
      } else {
        this.emit({ type: 'lose', reason: 'out-of-moves' })
      }
      return
    }

    if (!hasAvailableMove(cells, width, height, minMatch)) {
      shuffleBoard(
        cells,
        width,
        height,
        minMatch,
        this.def.board.cellTypes.length,
        this.rng,
        this.nextId,
      )
      this.emit({ type: 'shuffle', reason: 'no-moves' })
    }
  }

  private starsFor(score: number): number {
    const stars = this.def.levels[this.state.levelIndex]?.stars
    if (!stars) return 1
    if (score >= stars[2]) return 3
    if (score >= stars[1]) return 2
    return 1
  }

  /** Resolve any pre-existing matches on a hand-authored board, silently (no events). */
  private settleSilently(cells: Cell[], width: number, height: number, colorCount: number): void {
    const minMatch = this.def.rules.minMatch
    for (let guard = 0; guard < 100; guard++) {
      const groups = findMatches(cells, width, height, minMatch)
      if (groups.length === 0) break
      const cleared: Coord[] = []
      for (const g of groups) cleared.push(...g.cells)
      clearCells(cells, cleared, width)
      applyGravity(cells, width, height)
      refill(cells, width, height, colorCount, this.rng, this.nextId)
    }
  }
}

/** Convenience factory. */
export const createEngine = (): Engine => new Engine()
