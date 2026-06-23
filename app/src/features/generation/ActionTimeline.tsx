import { Button, Skeleton } from '../../design-system/primitives'
import type { GenerationState } from './reducer'

/**
 * "Polaroid developing" feedback: the agent's steps materialise as they stream,
 * with explanation text, a skeleton before the first step, and a stop button.
 */
export const ActionTimeline = ({
  state,
  onStop,
}: {
  state: GenerationState
  onStop: () => void
}) => {
  const streaming = state.status === 'streaming'
  return (
    <section aria-label="generation progress" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink">
          {streaming ? 'Building your game…' : state.status === 'done' ? 'Ready' : 'Generating'}
        </span>
        {streaming && (
          <Button variant="ghost" size="sm" onClick={onStop}>
            Stop
          </Button>
        )}
      </div>

      {streaming && state.steps.length === 0 && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}

      <ol className="flex flex-col gap-1.5">
        {state.steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className={
                step.done
                  ? 'text-success'
                  : 'inline-block size-3 animate-pulse rounded-full bg-accent motion-reduce:animate-none'
              }
            >
              {step.done ? '✓' : ''}
            </span>
            <span className={step.done ? 'text-muted' : 'text-ink'}>{step.label}</span>
          </li>
        ))}
      </ol>

      {state.text && <p className="text-sm text-muted">{state.text}</p>}

      {state.status === 'error' && (
        <p className="text-sm text-danger" role="alert">
          {state.error ?? 'Something went wrong.'}
        </p>
      )}
    </section>
  )
}
