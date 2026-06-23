import { generationHandlers } from '@candylovable/mocks'
import { setupWorker } from 'msw/browser'

/**
 * Dev-only Service Worker that serves the mocked generation pipeline
 * (the generate + iterate SSE endpoints) so `pnpm dev` runs the builder
 * end-to-end with no backend. Tests use `setupServer` (node) instead — this is
 * the browser twin.
 */
export const worker = setupWorker(...generationHandlers)

export const startMockWorker = (): Promise<unknown> =>
  worker.start({
    // The app only mocks the generation endpoints; let everything else (assets,
    // HMR, fonts) hit the network untouched.
    onUnhandledRequest: 'bypass',
    quiet: true,
  })
