import type { Coord, EngineEvent, JuiceConfig, SpecialKind } from '@candylovable/contract'

/**
 * The juice layer's BRAIN: pure mapping from a semantic {@link EngineEvent} to
 * render-agnostic animation directives. The Pixi renderer (hands) just plays
 * these. Feedback is scaled to event significance (a 3-match is modest, a big
 * combo is huge — CHI 2024) and degrades under reduced motion.
 */

export interface JuiceContext {
  juice: JuiceConfig
  reducedMotion: boolean
}

export type JuiceDirective =
  | { kind: 'swap'; a: Coord; b: Coord; revert: boolean; duration: number }
  | { kind: 'pop'; cells: Coord[]; intensity: number; duration: number }
  | { kind: 'particles'; cells: Coord[]; count: number }
  | { kind: 'fall'; moves: { from: Coord; to: Coord }[]; duration: number }
  | { kind: 'dropIn'; cells: Coord[]; duration: number }
  | { kind: 'special'; at: Coord; special: SpecialKind }
  | { kind: 'detonate'; origin: Coord; cleared: Coord[]; special: SpecialKind }
  | { kind: 'scorePopup'; delta: number; intensity: number; at?: Coord }
  | { kind: 'shake'; intensity: number; duration: number }
  | { kind: 'cascadePitch'; level: number }
  | { kind: 'win'; stars: number }
  | { kind: 'lose'; nearMiss: boolean }
  | { kind: 'shuffle' }

/** Match size → 0..1 significance. 3 = modest, 4 = strong, 5+ = huge. */
export const matchSignificance = (size: number): number => {
  if (size <= 3) return 0.35
  if (size === 4) return 0.7
  return 1
}

/** A detonation is "big enough" to warrant screen shake. */
const BIG_DETONATION = 5

export const mapEvent = (e: EngineEvent, ctx: JuiceContext): JuiceDirective[] => {
  const rm = ctx.reducedMotion
  const j = ctx.juice

  switch (e.type) {
    case 'swap':
      return [
        { kind: 'swap', a: e.a, b: e.b, revert: !e.accepted, duration: rm ? 0.06 : e.accepted ? 0.12 : 0.2 },
      ]

    case 'match': {
      const intensity = matchSignificance(e.size)
      const out: JuiceDirective[] = [
        { kind: 'pop', cells: e.cells, intensity, duration: rm ? 0.08 : 0.18 },
      ]
      if (!rm && j.particles > 0) {
        const count = Math.round((6 + intensity * 18) * j.particles)
        out.push({ kind: 'particles', cells: e.cells, count })
      }
      return out
    }

    case 'clear':
      // Rising pitch per cascade level (the "ratchet"); no transform → safe under RM.
      return [{ kind: 'cascadePitch', level: e.cascadeLevel }]

    case 'gravity':
      return [{ kind: 'fall', moves: e.moves, duration: rm ? 0.08 : 0.22 }]

    case 'refill':
      return [{ kind: 'dropIn', cells: e.cells.map((c) => c.at), duration: rm ? 0.08 : 0.24 }]

    case 'spawnSpecial':
      return [{ kind: 'special', at: e.at, special: e.kind }]

    case 'specialDetonate': {
      const out: JuiceDirective[] = [
        { kind: 'detonate', origin: e.origin, cleared: e.cleared, special: e.kind },
      ]
      if (!rm && j.screenShake > 0 && e.cleared.length >= BIG_DETONATION) {
        const intensity = Math.min(6, 2 + e.cleared.length * 0.3) * j.screenShake
        out.push({ kind: 'shake', intensity, duration: 0.18 })
      }
      return out
    }

    case 'score': {
      const intensity = Math.min(1, e.delta / 600)
      const d: JuiceDirective = { kind: 'scorePopup', delta: e.delta, intensity }
      if (e.at) d.at = e.at
      return [d]
    }

    case 'shuffle':
      return [{ kind: 'shuffle' }]

    case 'win':
      return [{ kind: 'win', stars: e.stars }]

    case 'lose':
      return [{ kind: 'lose', nearMiss: (e.shortBy ?? 0) > 0 }]

    case 'goalProgress':
    case 'nearMiss':
      // goalProgress drives HUD (not juice); nearMiss emphasis is folded into 'lose'.
      return []

    default:
      return []
  }
}
