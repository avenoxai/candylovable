import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LibraryJson } from '@candylovable/authoring'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { defaultClock, loadConfig } from './config'
import { loadLibraryRaw } from './library'
import { RealAuthoring } from './real-authoring'
import { JsonFileStore } from './store/json-file'

/** Production entry: real store + library, then start the Node HTTP server. */
const main = (): void => {
  const cfg = loadConfig()
  const store = new JsonFileStore(cfg.dataFile, defaultClock)
  const library = loadLibraryRaw(cfg.assetRoot)

  // Wire the real DeepSeek authoring pipeline when a key is present; otherwise fall back to
  // FakeAuthoring so `pnpm dev` works without credentials.
  const apiKey = process.env.DEEPSEEK_API_KEY
  const authoring = apiKey
    ? new RealAuthoring({
        apiKey,
        assetSkill: readFileSync(join(cfg.assetRoot, 'asset-skill.md'), 'utf8'),
        library: library as LibraryJson,
      })
    : undefined

  const app = createApp({ store, assetRoot: cfg.assetRoot, library, authoring })
  // Surface cumulative DeepSeek spend (the FE shows it as a running-cost badge).
  if (authoring) app.get('/api/cost', (c) => c.json(authoring.costSnapshot()))
  serve({ fetch: app.fetch, port: cfg.port })
  // eslint-disable-next-line no-console
  console.log(`candylovable server on :${cfg.port} — authoring: ${authoring ? 'DeepSeek (real)' : 'Fake (set DEEPSEEK_API_KEY for real)'}`)
}

main()
