import { Badge } from '../../design-system/primitives'
import type { HudState } from './useMatch3Session'

const GOAL_LABEL: Record<HudState['goalKind'], string> = {
  score: 'Score',
  clearJelly: 'Clear jelly',
  collect: 'Collect',
  bringDown: 'Bring down',
}

/** Presentational HUD: score, moves left, goal progress, end state. */
export const GameHud = ({ hud }: { hud: HudState }) => {
  const pct = hud.goalTarget > 0 ? Math.min(100, Math.round((hud.goalProgress / hud.goalTarget) * 100)) : 0
  return (
    <div className="flex items-center gap-4 text-sm text-ink" aria-label="game status">
      <div>
        <span className="text-muted">Score </span>
        <span className="font-semibold tabular-nums">{hud.score}</span>
      </div>
      <div>
        <span className="text-muted">Moves </span>
        <span className="font-semibold tabular-nums">{hud.movesLeft ?? '∞'}</span>
      </div>
      <div className="flex items-center gap-2" aria-label={`${GOAL_LABEL[hud.goalKind]} goal progress`}>
        <span className="text-muted">{GOAL_LABEL[hud.goalKind]}</span>
        <div
          className="h-2 w-24 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-accent transition-[width] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {hud.status === 'won' && <Badge tone="success">You win</Badge>}
      {hud.status === 'lost' && <Badge tone="danger">Out of moves</Badge>}
    </div>
  )
}
