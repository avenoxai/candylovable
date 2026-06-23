import type { Cell, GameDefinition, Move } from '@candylovable/contract'
import { toIndex } from '@candylovable/contract'
import { findMatches } from './board'
import { createEngine } from './engine'
import { findAvailableMoves } from './solver'

/**
 * The result of a deterministic headless analysis of one level — the SEMANTIC
 * validation oracle deepseek-infra's `simulate_level` delegates to (BE-D3/BE-D4).
 * Given a fixed `def`, `analyzeLevel` returns byte-identical results across runs.
 */
export interface LevelAnalysis {
  /** The generated/authored board has at least one legal move at the start. */
  hasInitialMove: boolean
  /** A greedy bot reaches the goal within the move limit (conservative ⇒ a human can). */
  solvable: boolean
  /** Trial 0's full play-out (canonical seed). */
  autoPlay: {
    won: boolean
    movesUsed: number
    score: number
    goalProgress: number
    cascades: number
  }
  /** Monotonic score thresholds [1★, 2★, 3★]; for score goals 1★ === target. v1 heuristic. */
  suggestedStars: [number, number, number]
  /** 0..1 difficulty estimate for the difficulty-oscillation curve. */
  difficulty: number
  /** Human-readable findings; on failure these feed deepseek-infra's repair loop. */
  notes: string[]
}

interface Trial {
  won: boolean
  score: number
  movesUsed: number
  goalProgress: number
  cascades: number
  hadInitialMove: boolean
}

/** Greedy move choice: maximise the immediate cleared-cell count, tie-break lowest index. */
const bestMove = (cells: Cell[], width: number, height: number, minMatch: number): Move | null => {
  const moves = findAvailableMoves(cells, width, height, minMatch)
  if (moves.length === 0) return null
  let best: Move = moves[0] as Move
  let bestCleared = -1
  let bestIdx = Number.POSITIVE_INFINITY
  for (const m of moves) {
    const clone = cells.slice()
    const ia = toIndex(m.a.x, m.a.y, width)
    const ib = toIndex(m.b.x, m.b.y, width)
    const tmp = clone[ia] as Cell
    clone[ia] = clone[ib] as Cell
    clone[ib] = tmp
    const cleared = findMatches(clone, width, height, minMatch).reduce((s, g) => s + g.size, 0)
    const idx = toIndex(m.a.x, m.a.y, width)
    if (cleared > bestCleared || (cleared === bestCleared && idx < bestIdx)) {
      best = m
      bestCleared = cleared
      bestIdx = idx
    }
  }
  return best
}

const playOut = (def: GameDefinition, levelIndex: number): Trial => {
  const engine = createEngine()
  const state = engine.init(def, levelIndex)
  const minMatch = def.rules.minMatch
  const hadInitialMove =
    findAvailableMoves(state.cells, state.width, state.height, minMatch).length > 0

  let cascades = 0
  engine.on('clear', () => {
    cascades++
  })

  const cap = (def.levels[levelIndex]?.moveLimit ?? 100) + 50
  let guard = 0
  while (engine.getState().status === 'playing' && guard++ < cap) {
    const s = engine.getState()
    const m = bestMove(s.cells, s.width, s.height, minMatch)
    if (!m) break
    engine.trySwap(m.a, m.b)
  }
  const s = engine.getState()
  return {
    won: s.status === 'won',
    score: s.score,
    movesUsed: s.movesUsed,
    goalProgress: s.goalProgress,
    cascades,
    hadInitialMove,
  }
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

/**
 * Headlessly analyse a level for solvability + fair star thresholds + difficulty.
 * Runs `trials` deterministic greedy play-outs (trial 0 = the canonical seed;
 * others use a deterministic id suffix to vary the board) and aggregates them.
 *
 * GATED goals: `clearJelly` / `bringDown` need runtime blocker/ingredient state that
 * the contract doesn't expose yet (BE-D7/D8). They are reported unsolvable with a
 * clear note so the model never ships an unwinnable level until CONTRACT_VERSION 2.
 */
export const analyzeLevel = (
  def: GameDefinition,
  levelIndex: number,
  opts: { trials?: number } = {},
): LevelAnalysis => {
  const level = def.levels[levelIndex]
  if (!level) throw new Error(`level ${levelIndex} not found`)
  const goal = level.goal
  const notes: string[] = []

  if (goal.kind === 'clearJelly' || goal.kind === 'bringDown') {
    notes.push(
      `unsupported-goal:${goal.kind} — needs CONTRACT_VERSION 2 (runtime blockers/ingredients); see decisions-backend BE-D7/BE-D8`,
    )
    const tgt = Math.max(1, goal.target)
    return {
      hasInitialMove: false,
      solvable: false,
      autoPlay: { won: false, movesUsed: 0, score: 0, goalProgress: 0, cascades: 0 },
      suggestedStars: [tgt, tgt * 2, tgt * 3],
      difficulty: 1,
      notes,
    }
  }

  if (level.blockers && level.blockers.length > 0) {
    notes.push(
      'unsupported:blockers present — analyzed IGNORING them (runtime blockers need CONTRACT_VERSION 2, BE-D7)',
    )
  }

  const trials = Math.max(1, opts.trials ?? 3)
  const results: Trial[] = []
  for (let i = 0; i < trials; i++) {
    const d = i === 0 ? def : ({ ...def, id: `${def.id}#a${i}` } as GameDefinition)
    results.push(playOut(d, levelIndex))
  }
  const autoPlay = results[0] as Trial
  const wonResults = results.filter((r) => r.won)
  const solvable = wonResults.length >= Math.ceil(trials / 2)

  const scores = (wonResults.length > 0 ? wonResults : results)
    .map((r) => r.score)
    .sort((a, b) => a - b)
  const median = scores[Math.floor(scores.length / 2)] ?? 0
  const maxScore = scores[scores.length - 1] ?? 0
  const s1 = goal.kind === 'score' ? Math.max(1, goal.target) : Math.max(1, Math.round(median * 0.5))
  const s3 = Math.max(s1 + 2, maxScore)
  const s2 = Math.min(Math.max(Math.round((s1 + s3) / 2), s1 + 1), s3 - 1)
  const suggestedStars: [number, number, number] = [s1, s2, s3]

  const ml = level.moveLimit
  const difficulty = !autoPlay.won ? 0.95 : ml ? clamp01(autoPlay.movesUsed / ml) : 0.3

  if (!autoPlay.hadInitialMove) notes.push('no initial move on the generated board (dead start)')
  if (!solvable) {
    const bestProgress = Math.max(...results.map((r) => r.goalProgress))
    notes.push(
      `greedy bot fell short — best progress ${bestProgress}/${goal.target}; raise moveLimit or lower target`,
    )
  }

  return {
    hasInitialMove: autoPlay.hadInitialMove,
    solvable,
    autoPlay: {
      won: autoPlay.won,
      movesUsed: autoPlay.movesUsed,
      score: autoPlay.score,
      goalProgress: autoPlay.goalProgress,
      cascades: autoPlay.cascades,
    },
    suggestedStars,
    difficulty,
    notes,
  }
}

/** Convenience: analyse every level in a def. */
export const analyzeGame = (def: GameDefinition, opts?: { trials?: number }): LevelAnalysis[] =>
  def.levels.map((l) => analyzeLevel(def, l.index, opts))
