import type { GameDefinition } from '@candylovable/contract'
import { useSelectionStore } from '../../store/selection'
import { entitiesFor } from './edit-entities'

/**
 * Select-and-edit affordance: the previewed game's editable entities (tiles,
 * background, goal) as a row of real buttons. Picking one attaches it as edit
 * context (shown as a chip in the chat composer); the next prompt iterates on it.
 * Accessible + jsdom-testable — the live Pixi board handles gameplay swaps.
 */
export const EditableElements = ({ def }: { def: GameDefinition }) => {
  const selected = useSelectionStore((s) => s.selected)
  const select = useSelectionStore((s) => s.select)
  const entities = entitiesFor(def)

  return (
    <div
      role="group"
      aria-label="editable elements"
      className="flex max-w-[560px] flex-wrap items-center justify-center gap-1.5"
    >
      {entities.map((e) => {
        const isSelected = selected?.kind === e.kind && selected?.ref === e.ref
        return (
          <button
            key={`${e.kind}:${e.ref ?? ''}`}
            type="button"
            aria-pressed={isSelected}
            aria-label={`edit ${e.label}`}
            onClick={() => select({ kind: e.kind, label: e.label, ref: e.ref })}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${
              isSelected
                ? 'border-accent bg-accent/15 text-ink'
                : 'border-border text-muted hover:text-ink'
            }`}
          >
            {e.swatch && (
              <span
                aria-hidden
                className="size-3 rounded-full border border-black/10"
                style={{ background: e.swatch }}
              />
            )}
            {e.label}
          </button>
        )
      })}
    </div>
  )
}
