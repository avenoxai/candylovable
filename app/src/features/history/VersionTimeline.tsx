import { cn } from '../../design-system/lib/cn'
import { useProjectStore } from '../../store/project'

/** Checkpoint strip — click any version to restore it (the fearless-undo safety net). */
export const VersionTimeline = () => {
  const history = useProjectStore((s) => s.history)
  const currentId = useProjectStore((s) => s.currentId)
  const restore = useProjectStore((s) => s.restore)

  if (history.length <= 1) return null

  return (
    <nav
      aria-label="version history"
      className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border px-4 py-2"
    >
      <span className="mr-1 text-xs text-muted">Versions</span>
      {history.map((cp) => {
        const active = cp.id === currentId
        return (
          <button
            key={cp.id}
            type="button"
            onClick={() => restore(cp.id)}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap transition-colors duration-150 motion-reduce:transition-none',
              active
                ? 'border-transparent bg-accent text-accent-ink'
                : 'border-border bg-surface text-muted hover:text-ink',
            )}
          >
            {cp.label}
          </button>
        )
      })}
    </nav>
  )
}
