import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import type { Clock } from './store/store'

/** Default edge clock: real uuid + wall clock. Injected so tests can be deterministic (BE-D6). */
export const defaultClock: Clock = {
  ids: () => randomUUID(),
  now: () => Date.now(),
}

export interface ServerConfig {
  port: number
  /** Filesystem path to the `assets/` dir (library.json + tile/bg PNGs). */
  assetRoot: string
  /** Where JsonFileStore persists (git-ignored). */
  dataFile: string
}

/** Resolve config from env, defaulting asset/data paths relative to the repo root. */
export const loadConfig = (): ServerConfig => {
  const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
  return {
    port: Number(process.env.PORT ?? 8787),
    assetRoot: process.env.ASSET_ROOT ?? `${repoRoot}assets`,
    dataFile: process.env.DATA_FILE ?? `${repoRoot}packages/server/.data/store.json`,
  }
}
