import type { GameDefinition } from '@candylovable/contract'
import { sampleMatch3 } from '@candylovable/mocks'
import { useEffect, useState } from 'react'
import type { GenerationStreamFn } from '../../lib/api/sse'
import { ChatPanel } from '../chat/ChatPanel'
import { useGeneration } from '../generation/useGeneration'
import { GameCanvas } from '../preview/GameCanvas'
import { TopBar } from './TopBar'

/**
 * The builder shell: chat (left) | live preview (right). The chat streams a
 * generation; when a game is ready it becomes the previewed GameDefinition.
 * `generate` is injectable for tests (defaults to the real SSE stream).
 */
export const Workspace = ({ generate }: { generate?: GenerationStreamFn } = {}) => {
  const gen = useGeneration(generate)
  const [def, setDef] = useState<GameDefinition>(sampleMatch3)

  useEffect(() => {
    if (gen.def) setDef(gen.def)
  }, [gen.def])

  return (
    <div className="flex h-full flex-col">
      <TopBar title={def.meta.title} />
      <div className="flex min-h-0 flex-1">
        <ChatPanel generation={gen} onGenerate={gen.start} onStop={gen.stop} />
        <main
          className="flex flex-1 items-center justify-center overflow-auto p-6"
          aria-label="live preview"
        >
          <GameCanvas def={def} />
        </main>
      </div>
    </div>
  )
}
