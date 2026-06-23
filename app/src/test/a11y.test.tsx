import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { AuthorPanel } from '../features/author/AuthorPanel'
import { ChatPanel } from '../features/chat/ChatPanel'
import { initialGenerationState } from '../features/generation/reducer'
import { EditableElements } from '../features/preview/EditableElements'
import { Workspace } from '../features/workspace/Workspace'
import { resetProjectStore, useProjectStore } from '../store/project'
import { resetSelectionStore } from '../store/selection'

afterEach(() => {
  resetProjectStore()
  resetSelectionStore()
})

// jsdom has no layout engine, so axe can't evaluate color-contrast here — that's
// covered by the OKLCH token contrast test (tokens.contrast.test.ts). Everything
// else (roles, names, labels, aria) is checked.
const axeOpts = { rules: { 'color-contrast': { enabled: false } } } as const

describe('accessibility (axe)', () => {
  it('the full workspace has no violations', async () => {
    const { container } = render(<Workspace />)
    expect(await axe(container, axeOpts)).toHaveNoViolations()
  })

  it('the author panel has no violations', async () => {
    const { container } = render(<AuthorPanel />)
    expect(await axe(container, axeOpts)).toHaveNoViolations()
  })

  it('the chat panel with an attached edit context has no violations', async () => {
    const { container } = render(
      <ChatPanel
        generation={initialGenerationState}
        onGenerate={() => {}}
        onStop={() => {}}
        context={{ kind: 'background', label: 'Background' }}
        onClearContext={() => {}}
      />,
    )
    expect(await axe(container, axeOpts)).toHaveNoViolations()
  })

  it('the editable-elements selector has no violations', async () => {
    const def = useProjectStore.getState().current
    const { container } = render(<EditableElements def={def} />)
    expect(await axe(container, axeOpts)).toHaveNoViolations()
  })
})
