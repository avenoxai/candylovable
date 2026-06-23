import { type Coord, type GameDefinition, type GoalKind, isAdjacent } from '@candylovable/contract'
import { BoardController, type Scene } from '@candylovable/game-runtime'
import { FakeEngine } from '@candylovable/mocks'
import { useCallback, useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../../design-system/motion/motion'

export interface HudState {
  score: number
  movesUsed: number
  moveLimit?: number
  movesLeft: number | null
  status: 'playing' | 'won' | 'lost'
  goalKind: GoalKind
  goalProgress: number
  goalTarget: number
}

const readHud = (engine: FakeEngine): HudState => {
  const s = engine.getState()
  return {
    score: s.score,
    moveLimit: s.moveLimit,
    movesUsed: s.movesUsed,
    movesLeft: s.moveLimit === undefined ? null : Math.max(0, s.moveLimit - s.movesUsed),
    status: s.status,
    goalKind: s.goal.kind,
    goalProgress: s.goalProgress,
    goalTarget: s.goal.target,
  }
}

const initialHud = (def: GameDefinition): HudState => {
  const level = def.levels[0]
  const goal = level?.goal ?? { kind: 'score' as const, target: 0 }
  return {
    score: 0,
    movesUsed: 0,
    moveLimit: level?.moveLimit,
    movesLeft: level?.moveLimit ?? null,
    status: 'playing',
    goalKind: goal.kind,
    goalProgress: 0,
    goalTarget: goal.target,
  }
}

export interface UseMatch3Options {
  reducedMotion?: boolean
  viewport?: { width: number; height: number }
}

/**
 * Wires a FakeEngine ↔ BoardController ↔ a (injected) Scene and exposes HUD state
 * + a tap-to-swap handler. Scene is injectable so this is jsdom-testable with a
 * fake (no Pixi); GameCanvas passes a real PixiScene.
 */
export const useMatch3Session = (
  def: GameDefinition,
  scene: Scene | null,
  opts: UseMatch3Options = {},
) => {
  const reducedMotion = opts.reducedMotion ?? prefersReducedMotion()
  const viewportW = opts.viewport?.width ?? 640
  const viewportH = opts.viewport?.height ?? 640

  const engineRef = useRef<FakeEngine | null>(null)
  const controllerRef = useRef<BoardController | null>(null)
  const selectedRef = useRef<Coord | null>(null)
  const [hud, setHud] = useState<HudState>(() => initialHud(def))
  const [selected, setSelected] = useState<Coord | null>(null)

  useEffect(() => {
    if (!scene) return
    const engine = new FakeEngine()
    const state = engine.init(def, 0)
    const controller = new BoardController(scene, def, {
      reducedMotion,
      viewport: { width: viewportW, height: viewportH },
    })
    controller.seed(state)
    const unsub = engine.onAny((e) => {
      controller.handle(e)
      setHud(readHud(engine))
    })
    engineRef.current = engine
    controllerRef.current = controller
    setHud(readHud(engine))
    return () => {
      unsub()
      scene.reset()
      engineRef.current = null
      controllerRef.current = null
      selectedRef.current = null
      setSelected(null)
    }
  }, [scene, def, reducedMotion, viewportW, viewportH])

  const onCellPick = useCallback((c: Coord): void => {
    const engine = engineRef.current
    if (!engine || engine.getState().status !== 'playing') return
    const sel = selectedRef.current
    if (!sel) {
      selectedRef.current = c
      setSelected(c)
      return
    }
    if (sel.x === c.x && sel.y === c.y) {
      selectedRef.current = null
      setSelected(null)
      return
    }
    if (isAdjacent(sel, c)) {
      engine.trySwap(sel, c)
      selectedRef.current = null
      setSelected(null)
    } else {
      selectedRef.current = c
      setSelected(c)
    }
  }, [])

  const reset = useCallback((): void => {
    const engine = engineRef.current
    const controller = controllerRef.current
    if (!engine || !controller) return
    engine.reset()
    controller.seed(engine.getState()) // redraw the fresh board
    selectedRef.current = null
    setSelected(null)
    setHud(readHud(engine))
  }, [])

  return { hud, selected, onCellPick, reset, ready: scene !== null }
}
