import { useEffect, useState } from 'react'
import type { EditContext, GenerationStreamFn } from '../../lib/api/sse'
import { useProjectStore } from '../../store/project'
import { useSelectionStore } from '../../store/selection'
import { AuthorPanel } from '../author/AuthorPanel'
import { ChatPanel } from '../chat/ChatPanel'
import { useGeneration } from '../generation/useGeneration'
import { VersionTimeline } from '../history/VersionTimeline'
import { EditableElements } from '../preview/EditableElements'
import { GameCanvas } from '../preview/GameCanvas'
import { TopBar } from './TopBar'

/**
 * The builder shell: chat (left) | live preview (right), with a version strip.
 * A finished generation is committed as a new checkpoint and becomes the preview.
 * `generate` is injectable for tests (defaults to the real SSE stream).
 */
export const Workspace = ({ generate }: { generate?: GenerationStreamFn } = {}) => {
  const gen = useGeneration(generate)
  const current = useProjectStore((s) => s.current)
  const commit = useProjectStore((s) => s.commit)
  const selected = useSelectionStore((s) => s.selected)
  const clearSelection = useSelectionStore((s) => s.clear)
  const [costRefresh, setCostRefresh] = useState(0)

  useEffect(() => {
    if (gen.def) commit(gen.def, gen.def.meta.title)
  }, [gen.def, commit])

  // A finished generation consumes the selection and refreshes the running-cost badge.
  useEffect(() => {
    if (gen.status === 'done') {
      clearSelection()
      setCostRefresh((n) => n + 1)
    }
  }, [gen.status, clearSelection])

  // A bare prompt generates a fresh game; a prompt with a selected entity iterates
  // on the current one, scoped to that entity.
  const generateOrIterate = (prompt: string, context?: EditContext): void => {
    void gen.start(prompt, context ? { context, baseId: current.id } : {})
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar title={current.meta.title} costRefresh={costRefresh} />
      <VersionTimeline />
      <div className="flex min-h-0 flex-1">
        <ChatPanel
          generation={gen}
          onGenerate={generateOrIterate}
          onStop={gen.stop}
          context={selected}
          onClearContext={clearSelection}
        />
        <main
          className="flex flex-1 flex-col items-center justify-center gap-4 overflow-auto p-6"
          aria-label="live preview"
        >
          <GameCanvas def={current} />
          <EditableElements def={current} />
        </main>
        <AuthorPanel />
      </div>
    </div>
  )
}
