import type { GameDefinition } from '@candylovable/contract'
import type { AssetCatalog } from '../assets/catalog'
import { type EngineFactory, simulateAll } from '../validate/simulate-level'
import { validateGame } from '../validate/validate-game'

export interface ScoreDimension {
  name: string
  score: number
  max: number
  note: string
}
export interface Scorecard {
  score: number
  dimensions: ScoreDimension[]
}

export interface ScoreOptions {
  catalog?: AssetCatalog
  makeEngine?: EngineFactory
}

/**
 * Score a generated GameDefinition 0-100 against the `benchmark/RATIONALE` rubric. Grades
 * DIMENSIONS, not byte-equality with the reference — a different-but-good game can score full
 * marks. DoD for the goal: a live run scores >= 80 with dimension 1 (valid+solvable) green.
 */
export function scoreGame(def: GameDefinition, opts: ScoreOptions = {}): Scorecard {
  const dims: ScoreDimension[] = []
  const add = (name: string, score: number, max: number, note: string): void => {
    dims.push({ name, score, max, note })
  }

  // 1. valid + solvable (25) — the gate; failing it caps quality low
  const errors = validateGame(def, opts.catalog)
  const solvable = simulateAll(def, opts.makeEngine).every((s) => s.solvableStart)
  add(
    'valid+solvable',
    errors.length === 0 ? (solvable ? 25 : 10) : 0,
    25,
    errors.length > 0 ? `${errors.length} validation errors` : solvable ? 'ok' : 'a level is unsolvable',
  )

  // 2. difficulty curve oscillates (20)
  const targets = def.levels.map((l) => l.goal.target)
  const hasBreather = targets.some((t, i) => i > 0 && t < targets[i - 1]!)
  add('difficulty-curve', def.levels.length >= 3 ? (hasBreather ? 20 : 8) : 5, 20, hasBreather ? 'oscillates' : 'monotonic ramp')

  // 3. goal variety (15)
  const kinds = new Set(def.levels.map((l) => l.goal.kind)).size
  add('goal-variety', kinds >= 3 ? 15 : kinds === 2 ? 11 : 4, 15, `${kinds} goal kind(s)`)

  // 4. rules coherence (12) — specials present + bonuses ordered by power
  const bonus = def.rules.scoring.specialCreateBonus
  const ordered = (bonus['striped-h'] ?? 0) <= (bonus.wrapped ?? Number.POSITIVE_INFINITY) && (bonus.wrapped ?? 0) <= (bonus.colorBomb ?? Number.POSITIVE_INFINITY)
  add('rules-coherence', def.rules.specials.length > 0 && ordered ? 12 : def.rules.specials.length > 0 ? 7 : 3, 12, ordered ? 'coherent' : 'bonus order off')

  // 5. theme fit (10)
  const themeOk = (!opts.catalog || opts.catalog.hasTheme(def.theme.id)) && def.theme.tiles.length === 6 && def.theme.palette.length === 6
  add('theme-fit', themeOk ? 10 : 4, 10, themeOk ? 'ok' : 'theme/tiles/palette off')

  // 6. juice — tuned, not maxed, reduced-motion honoured (10)
  const j = def.juice
  const inRange = [j.particles, j.screenShake, j.squashStretch, j.cascadePitch].every((v) => v >= 0 && v <= 1)
  const notMaxed = !(j.particles === 1 && j.screenShake === 1 && j.squashStretch === 1 && j.cascadePitch === 1)
  add('juice', j.reducedMotionFallback && inRange && notMaxed ? 10 : 4, 10, j.reducedMotionFallback ? 'ok' : 'no reduced-motion fallback')

  // 7. stars (8) — strictly increasing + 1-star == score goal
  const starsOk = def.levels.every((l) => {
    if (!l.stars) return false
    const mono = l.stars[0] < l.stars[1] && l.stars[1] < l.stars[2]
    const oneStar = l.goal.kind !== 'score' || l.stars[0] === l.goal.target
    return mono && oneStar
  })
  add('stars', starsOk ? 8 : 3, 8, starsOk ? 'ok' : 'thresholds off')

  return { score: dims.reduce((sum, d) => sum + d.score, 0), dimensions: dims }
}
