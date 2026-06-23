import { serve } from '@hono/node-server'
import { createApp } from './app'
import { defaultClock, loadConfig } from './config'
import { loadLibraryRaw } from './library'
import { JsonFileStore } from './store/json-file'

/** Production entry: real store + library, then start the Node HTTP server. */
const main = (): void => {
  const cfg = loadConfig()
  const store = new JsonFileStore(cfg.dataFile, defaultClock)
  const library = loadLibraryRaw(cfg.assetRoot)
  const app = createApp({ store, assetRoot: cfg.assetRoot, library })
  serve({ fetch: app.fetch, port: cfg.port })
  // eslint-disable-next-line no-console
  console.log(`candylovable server listening on :${cfg.port}`)
}

main()
