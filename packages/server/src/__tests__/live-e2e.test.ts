import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LibraryJson } from '@candylovable/authoring'
import { describe, expect, it } from 'vitest'
import { createApp } from '../app'
import { defaultClock, loadConfig } from '../config'
import { loadLibraryRaw } from '../library'
import { RealAuthoring } from '../real-authoring'
import { parseSSE } from '../sse'
import { MemoryStore } from '../store/memory'

/**
 * The definitive integration proof: a real DeepSeek run THROUGH the HTTP server. POSTs the
 * benchmark prompt to `/api/generate`, reads the SSE stream, asserts a `gameReady` with a
 * valid GameDefinition. In-process via `app.fetch` (no socket). GATED behind DEEPSEEK_LIVE=1.
 */
const LIVE = Boolean(process.env.DEEPSEEK_LIVE)

describe.runIf(LIVE)('HTTP /api/generate — LIVE end-to-end (real DeepSeek through the server)', () => {
  it(
    'streams gameReady with a valid GameDefinition',
    async () => {
      const cfg = loadConfig()
      const library = loadLibraryRaw(cfg.assetRoot)
      const assetSkill = readFileSync(join(cfg.assetRoot, 'asset-skill.md'), 'utf8')
      const authoring = new RealAuthoring({
        apiKey: process.env.DEEPSEEK_API_KEY ?? '',
        assetSkill,
        library: library as LibraryJson,
      })
      const app = createApp({ store: new MemoryStore(defaultClock), assetRoot: cfg.assetRoot, library, authoring })

      const res = await app.fetch(
        new Request('http://local/api/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: 'make me a simple candy crush style match-3, a few levels, juicy' }),
        }),
      )
      expect(res.ok).toBe(true)
      expect(res.headers.get('X-Session-Id')).toBeTruthy()

      const events = parseSSE(await res.text())
      // eslint-disable-next-line no-console
      console.log('[e2e] events:', events.map((e) => e.type).filter((t) => t !== 'partial' && t !== 'step').join(','))
      const ready = events.find((e) => e.type === 'gameReady')
      expect(ready).toBeDefined()
      if (ready?.type === 'gameReady') {
        expect(ready.def.meta.gameType).toBe('match3')
        expect(ready.def.theme.tiles).toHaveLength(6)
      }
    },
    280_000,
  )
})
