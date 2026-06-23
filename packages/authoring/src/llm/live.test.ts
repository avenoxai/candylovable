import { describe, expect, it } from 'vitest'
import { loadConfig } from '../config'
import { HttpDeepSeekClient } from './http'

/**
 * Live smoke against the real DeepSeek API. GATED behind DEEPSEEK_LIVE=1 so it never runs
 * in CI (no network there). Run locally with: `DEEPSEEK_LIVE=1 pnpm test`.
 */
const LIVE = Boolean(process.env.DEEPSEEK_LIVE)

describe.runIf(LIVE)('HttpDeepSeekClient (live)', () => {
  it(
    'flash and pro both respond and report token usage',
    async () => {
      const cfg = loadConfig()
      expect(cfg.apiKey).not.toBe('')
      const client = new HttpDeepSeekClient({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl })
      for (const model of ['flash', 'pro'] as const) {
        const r = await client.chat({
          model,
          messages: [{ role: 'user', content: 'Reply with exactly: pong' }],
          maxTokens: 200,
        })
        expect(r.usage.promptTokens).toBeGreaterThan(0)
      }
    },
    60_000,
  )
})
