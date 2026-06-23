import { useEffect } from 'react'
import type { GenerationStreamFn } from '../../lib/api/sse'
import { useProjectStore } from '../../store/project'
import { AuthorPanel } from '../author/AuthorPanel'
import { ChatPanel } from '../chat/ChatPanel'
import { useGeneration } from '../generation/useGeneration'
import { VersionTimeline } from '../history/VersionTimeline'
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

  useEffect(() => {
    if (gen.def) commit(gen.def, gen.def.meta.title)
  }, [gen.def, commit])

  return (
    <div className="flex h-full flex-col">
      <TopBar title={current.meta.title} />
      <VersionTimeline />
      <div className="flex min-h-0 flex-1">
        <ChatPanel generation={gen} onGenerate={gen.start} onStop={gen.stop} />
        <main
          className="flex flex-1 items-center justify-center overflow-auto p-6"
          aria-label="live preview"
        >
          <GameCanvas def={current} />
        </main>
        <AuthorPanel />
      </div>
    </div>
  )
}
