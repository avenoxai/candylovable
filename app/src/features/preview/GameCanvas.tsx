import type { GameDefinition } from '@candylovable/contract'
import { type Scene, computeLayout, pixelToCell } from '@candylovable/game-runtime'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../design-system/primitives'
import { GameHud } from './GameHud'
import { useMatch3Session } from './useMatch3Session'

const SIZE = 560

/**
 * The live preview: a Pixi board playing a mock match-3 with full juice, plus a
 * HUD and reset. Browser-only (mounts WebGL) — exercised by Playwright; its React
 * logic (input → swap, HUD) lives in the jsdom-tested useMatch3Session hook.
 */
export const GameCanvas = ({ def }: { def: GameDefinition }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scene, setScene] = useState<Scene | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false
    let live: { destroy(): void } | null = null
    // Dynamic import keeps Pixi/WebGL out of the module graph for jsdom/SSR.
    void (async () => {
      try {
        const { PixiScene } = await import('@candylovable/game-runtime/pixi')
        const pixi = new PixiScene({ backgroundColor: def.theme.backdropColor })
        await pixi.init(canvas, SIZE, SIZE)
        if (disposed) {
          pixi.destroy()
          return
        }
        live = pixi
        setScene(pixi)
      } catch {
        /* no WebGL (e.g. headless/jsdom) — HUD still renders */
      }
    })()
    return () => {
      disposed = true
      live?.destroy()
      setScene(null)
    }
  }, [def])

  const { hud, selected, onCellPick, reset } = useMatch3Session(def, scene, {
    viewport: { width: SIZE, height: SIZE },
  })

  const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    const layout = computeLayout(def.board.width, def.board.height, SIZE, SIZE)
    const cell = pixelToCell(layout, e.clientX - rect.left, e.clientY - rect.top)
    if (cell) onCellPick(cell)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <GameHud hud={hud} />
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        onPointerDown={handlePointer}
        className="touch-none rounded-[var(--radius)] border border-border"
        aria-label="game board"
        data-selected={selected ? `${selected.x},${selected.y}` : ''}
      />
      <Button variant="secondary" size="sm" onClick={reset}>
        Restart
      </Button>
    </div>
  )
}
