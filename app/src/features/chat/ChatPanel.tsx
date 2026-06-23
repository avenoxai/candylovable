import { useState } from 'react'
import { Button, PromptComposer } from '../../design-system/primitives'

const EXAMPLES = [
  'A candy match-3 where you clear jelly in 20 moves',
  'A gem swap puzzle that gets harder each level',
  'An emoji match game for kids with big friendly tiles',
]

/**
 * Builder chat / empty state (Phase 2 shell). The composer + example chips are
 * live; wiring them to streamed generation is Phase 3.
 */
export const ChatPanel = ({ onGenerate }: { onGenerate?: (prompt: string) => void }) => {
  const [value, setValue] = useState('')
  const submit = (): void => {
    const prompt = value.trim()
    if (prompt) onGenerate?.(prompt)
  }

  return (
    <aside
      className="flex h-full w-full max-w-sm flex-col gap-4 border-r border-border p-4"
      aria-label="builder chat"
    >
      <div className="flex-1">
        <h2 className="text-lg font-medium text-ink">Describe a puzzle game</h2>
        <p className="mt-1 text-sm text-muted">Type an idea — watch it come to life.</p>
        <ul className="mt-4 flex flex-col gap-2">
          {EXAMPLES.map((ex) => (
            <li key={ex}>
              <Button
                variant="secondary"
                size="sm"
                className="h-auto w-full justify-start py-2 text-left whitespace-normal"
                onClick={() => setValue(ex)}
              >
                {ex}
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <PromptComposer
        value={value}
        onChange={setValue}
        onSubmit={submit}
        placeholder="e.g. a fruit match-3 with bombs"
      />
    </aside>
  )
}
