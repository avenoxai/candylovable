import { useState } from 'react'
import { Button, PromptComposer } from '../../design-system/primitives'
import { ActionTimeline } from '../generation/ActionTimeline'
import type { GenerationState } from '../generation/reducer'

const EXAMPLES = [
  'A candy match-3 where you clear jelly in 20 moves',
  'A gem swap puzzle that gets harder each level',
  'An emoji match game for kids with big friendly tiles',
]

const EmptyState = ({ onPick }: { onPick: (v: string) => void }) => (
  <div>
    <h2 className="text-lg font-medium text-ink">Describe a puzzle game</h2>
    <p className="mt-1 text-sm text-muted">Type an idea — watch it come to life.</p>
    <ul className="mt-4 flex flex-col gap-2">
      {EXAMPLES.map((ex) => (
        <li key={ex}>
          <Button
            variant="secondary"
            size="sm"
            className="h-auto w-full justify-start py-2 text-left whitespace-normal"
            onClick={() => onPick(ex)}
          >
            {ex}
          </Button>
        </li>
      ))}
    </ul>
  </div>
)

export interface ChatPanelProps {
  generation: GenerationState
  onGenerate: (prompt: string) => void
  onStop: () => void
}

/** Chat lane: empty-state until the first prompt, then the streaming timeline. */
export const ChatPanel = ({ generation, onGenerate, onStop }: ChatPanelProps) => {
  const [value, setValue] = useState('')
  const streaming = generation.status === 'streaming'
  const submit = (): void => {
    const prompt = value.trim()
    if (prompt) {
      onGenerate(prompt)
      setValue('')
    }
  }

  return (
    <aside
      className="flex h-full w-full max-w-sm flex-col gap-4 border-r border-border p-4"
      aria-label="builder chat"
    >
      <div className="min-h-0 flex-1 overflow-auto">
        {generation.status === 'idle' ? (
          <EmptyState onPick={setValue} />
        ) : (
          <ActionTimeline state={generation} onStop={onStop} />
        )}
      </div>
      <PromptComposer
        value={value}
        onChange={setValue}
        onSubmit={submit}
        disabled={streaming}
        placeholder="e.g. a fruit match-3 with bombs"
      />
    </aside>
  )
}
