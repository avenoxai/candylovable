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
  type Tile,
  type Unsubscribe,
  isAdjacent,
  toIndex,
} from '@candylovable/contract'
import {
  type Rng,
  applyGravity,
  clearCells,
  findAvailableMoves,
  findMatches,
  generateBoard,
  hasAvailableMove,
  makeIdFactory,
  mulberry32,
  refill,
  shuffleBoard,
} from './board'

const hashString = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * A functional, deterministic match-3 engine used to drive the FE renderer and
 * tests before the real `engine/` lands. It implements the same cascade the real
 * engine must (match → clear → gravity → refill) and emits the same semantic
 * {@link EngineEvent}s, so it doubles as a reference for the system agent.
 *
 * NOT yet modelled (the real engine owns these): special-tile detonation chains,
 * jelly/crate/rock blockers, collect/bringDown goal types beyond a basic counter.
 */
export class FakeEngine implements EngineInstance {
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
    this.rng = mulberry32(hashString(def.id) ^ ((levelIndex + 1) * 0x9e3779b1))
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

    const initialState: GameState = {
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
    if (level.moveLimit !== undefined) initialState.moveLimit = level.moveLimit
    this.state = initialState
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
    this.swap(cells, a, b)
    if (findMatches(cells, width, height, minMatch).length === 0) {
      this.swap(cells, a, b)
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

  private swap(cells: Cell[], a: Coord, b: Coord): void {
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
      // Heuristic near-miss: lost while within ~15% of the target → emphasise it.
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
    const level = this.def.levels[this.state.levelIndex]
    const stars = level?.stars
    if (!stars) return 1
    if (score >= stars[2]) return 3
    if (score >= stars[1]) return 2
    if (score >= stars[0]) return 1
    return 1
  }

  /** Resolve any pre-existing matches on a hand-authored board with no events. */
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
export const createFakeEngine = (): FakeEngine => new FakeEngine()

export type { Tile }
