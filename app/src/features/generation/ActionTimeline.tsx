import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { UI_SPRING, UI_STAGGER } from '../../design-system/motion/motion'
import { Button, Skeleton } from '../../design-system/primitives'
import type { GenerationState } from './reducer'

/** A slowly sweeping gradient over the heading text — the "thinking…" shimmer. */
const ShimmerLabel = ({ children, reduce }: { children: string; reduce: boolean }) => (
  <motion.span
    className="bg-clip-text text-sm font-medium text-transparent"
    style={{
      backgroundImage: 'linear-gradient(90deg, var(--text-muted), var(--text), var(--text-muted))',
      backgroundSize: '200% 100%',
    }}
    animate={reduce ? { backgroundPositionX: '100%' } : { backgroundPositionX: ['0%', '-200%'] }}
    transition={reduce ? undefined : { repeat: Infinity, ease: 'linear', duration: 1.8 }}
  >
    {children}
  </motion.span>
)

/** Rotating arc while a step runs (a static dot when motion is reduced). */
const Spinner = ({ reduce }: { reduce: boolean }) =>
  reduce ? (
    <span aria-hidden className="inline-block size-3 rounded-full bg-accent" />
  ) : (
    <motion.span
      aria-hidden
      className="inline-block size-3 rounded-full border-2 border-accent/25 border-t-accent"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, ease: 'linear', duration: 0.8 }}
    />
  )

/** Check that pops in when a step completes. */
const Check = () => (
  <motion.span
    aria-hidden
    className="text-success"
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={UI_SPRING}
  >
    ✓
  </motion.span>
)

/**
 * "Polaroid developing" feedback: the agent's steps materialise as they stream —
 * each row slides in, runs with a spinner, then pops a check; the heading shimmers
 * and the explanation text trails a typing caret. Honors prefers-reduced-motion.
 */
export const ActionTimeline = ({
  state,
  onStop,
}: {
  state: GenerationState
  onStop: () => void
}) => {
  const reduce = useReducedMotion() ?? false
  const streaming = state.status === 'streaming'
  // The latest not-yet-done step is the one actively "working".
  const activeId = streaming ? [...state.steps].reverse().find((s) => !s.done)?.id : undefined

  return (
    <MotionConfig reducedMotion="user">
      <section aria-label="generation progress" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          {streaming ? (
            <ShimmerLabel reduce={reduce}>Building your game…</ShimmerLabel>
          ) : (
            <span className="text-sm font-medium text-ink">
              {state.status === 'done' ? 'Ready' : 'Generating'}
            </span>
          )}
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

        <ol className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {state.steps.map((step, i) => {
              const active = step.id === activeId
              return (
                <motion.li
                  key={step.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ ...UI_SPRING, delay: reduce ? 0 : i * UI_STAGGER }}
                  className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors ${
                    active ? 'bg-accent/8' : ''
                  }`}
                >
                  <span className="grid size-3 place-items-center">
                    {step.done ? <Check /> : <Spinner reduce={reduce} />}
                  </span>
                  <span className={step.done ? 'text-muted' : 'text-ink'}>{step.label}</span>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ol>

        {state.text && (
          <p className="whitespace-pre-line text-sm text-muted">
            {state.text.trimEnd()}
            {streaming && (
              <motion.span
                aria-hidden
                className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 bg-accent"
                animate={reduce ? { opacity: 1 } : { opacity: [1, 1, 0, 0] }}
                transition={reduce ? undefined : { repeat: Infinity, duration: 1, times: [0, 0.5, 0.5, 1] }}
              />
            )}
          </p>
        )}

        {state.status === 'error' && (
          <p className="text-sm text-danger" role="alert">
            {state.error ?? 'Something went wrong.'}
          </p>
        )}
      </section>
    </MotionConfig>
  )
}
