import { sampleMatch3 } from '@candylovable/mocks'
import { ChatPanel } from '../chat/ChatPanel'
import { GameCanvas } from '../preview/GameCanvas'
import { TopBar } from './TopBar'

/**
 * The builder shell: chat (left) | live preview (right), under a top bar.
 * Phase 2 mounts the mock match-3 in the preview; Phase 3 wires the chat to
 * streamed generation that swaps the previewed GameDefinition.
 */
export const Workspace = () => (
  <div className="flex h-full flex-col">
    <TopBar title={sampleMatch3.meta.title} />
    <div className="flex min-h-0 flex-1">
      <ChatPanel />
      <main
        className="flex flex-1 items-center justify-center overflow-auto p-6"
        aria-label="live preview"
      >
        <GameCanvas def={sampleMatch3} />
      </main>
    </div>
  </div>
)
