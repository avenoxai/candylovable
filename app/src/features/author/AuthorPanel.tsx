import { THEME_IDS, type ThemeId, resolveTheme } from '@candylovable/mocks'
import { useState } from 'react'
import { Button } from '../../design-system/primitives'
import { useProjectStore } from '../../store/project'

type JuiceKey = 'particles' | 'screenShake' | 'squashStretch'
const JUICE_KEYS: JuiceKey[] = ['particles', 'screenShake', 'squashStretch']

const numberInputCls =
  'w-20 rounded-md border border-border bg-surface px-2 py-1 text-right text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]'

/**
 * Author controls — the "what the author tunes" surface: theme, juice intensities,
 * level goal/moves. Edits update the live preview; "Save version" checkpoints it.
 */
export const AuthorPanel = () => {
  const def = useProjectStore((s) => s.current)
  const setCurrent = useProjectStore((s) => s.setCurrent)
  const commit = useProjectStore((s) => s.commit)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const level = def.levels[0]

  const setTheme = (id: ThemeId): void => setCurrent({ ...def, theme: resolveTheme(id) })
  const setJuice = (k: JuiceKey, v: number): void =>
    setCurrent({ ...def, juice: { ...def.juice, [k]: v } })
  const patchLevel = (patch: Partial<NonNullable<typeof level>>): void =>
    setCurrent({ ...def, levels: def.levels.map((l, i) => (i === 0 ? { ...l, ...patch } : l)) })

  return (
    <aside
      aria-label="author panel"
      className="flex h-full w-72 shrink-0 flex-col gap-5 overflow-auto border-l border-border p-4"
    >
      <section>
        <h3 className="text-sm font-medium text-ink">Theme</h3>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {THEME_IDS.map((id) => (
            <Button
              key={id}
              size="sm"
              variant={def.theme.id === id ? 'primary' : 'secondary'}
              aria-pressed={def.theme.id === id}
              onClick={() => setTheme(id)}
            >
              {id}
            </Button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-ink">Juice</h3>
        <div className="mt-2 flex flex-col gap-2">
          {JUICE_KEYS.map((k) => (
            <label key={k} className="flex items-center justify-between gap-2 text-xs text-muted">
              <span>{k}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={def.juice[k]}
                aria-label={k}
                onChange={(e) => setJuice(k, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-ink">Level 1</h3>
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex items-center justify-between text-xs text-muted">
            <span>Goal target</span>
            <input
              type="number"
              className={numberInputCls}
              value={level?.goal.target ?? 0}
              aria-label="goal target"
              onChange={(e) =>
                level && patchLevel({ goal: { ...level.goal, target: Number(e.target.value) } })
              }
            />
          </label>
          <label className="flex items-center justify-between text-xs text-muted">
            <span>Move limit</span>
            <input
              type="number"
              className={numberInputCls}
              value={level?.moveLimit ?? 0}
              aria-label="move limit"
              onChange={(e) => patchLevel({ moveLimit: Number(e.target.value) })}
            />
          </label>
        </div>
      </section>

      <div className="mt-auto flex flex-col gap-2">
        <Button variant="secondary" size="sm" onClick={() => commit(def, `${def.meta.title} (edit)`)}>
          Save version
        </Button>
        <Button
          variant="gradient"
          size="sm"
          onClick={() => setShareUrl(`https://candylovable.app/p/${def.id}`)}
        >
          Publish
        </Button>
        {shareUrl && (
          <p className="break-all text-xs text-muted" role="status">
            {shareUrl}
          </p>
        )}
      </div>
    </aside>
  )
}
