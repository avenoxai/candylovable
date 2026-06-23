import { type KeyboardEvent } from 'react'
import { cn } from '../lib/cn'
import { Button } from './Button'

export interface PromptComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  disabled?: boolean
  submitLabel?: string
  className?: string
}

/** Prompt input: Enter submits, Shift+Enter newlines. Submit disabled when empty. */
export const PromptComposer = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled = false,
  submitLabel = 'Generate',
  className,
}: PromptComposerProps) => {
  const canSubmit = value.trim().length > 0 && !disabled

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSubmit) onSubmit()
    }
  }

  return (
    <div className={cn('flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-surface p-2', className)}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        aria-label="prompt"
        className="resize-none bg-transparent px-2 py-1 text-sm text-ink placeholder:text-muted focus-visible:outline-none disabled:opacity-50"
      />
      <div className="flex justify-end">
        <Button size="sm" variant="gradient" onClick={onSubmit} disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
