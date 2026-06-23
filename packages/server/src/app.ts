import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { CONTRACT_VERSION, type GameDefinition } from '@candylovable/contract'
import { analyzeGame } from '@candylovable/engine'
import { Hono } from 'hono'
import { resolveThemes } from './library'
import type { Store } from './store/store'

export interface AppDeps {
  store: Store
  /** Filesystem path to the `assets/` dir. */
  assetRoot: string
  /** Parsed `library.json` (raw — served verbatim). */
  library: unknown
  /** Defaults to the engine's analyzeGame; injectable for tests. */
  analyze?: typeof analyzeGame
}

const CONTENT_TYPE: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
}

/**
 * The serving Hono app (BE-D2). Built from injected deps so every route is testable via
 * `app.request(...)` with no network and no real DeepSeek. P4 mounts serving + validation;
 * P5 adds the generate/iterate SSE routes on top of the same factory.
 */
export const createApp = (deps: AppDeps): Hono => {
  const app = new Hono()
  const analyze = deps.analyze ?? analyzeGame
  const themes = resolveThemes(deps.library)
  const assetBase = resolve(deps.assetRoot)

  app.get('/api/health', (c) => c.json({ ok: true, contractVersion: CONTRACT_VERSION }))

  // Asset catalog — served VERBATIM; backend never reshapes the assets/visual seam.
  app.get('/api/library', (c) => c.json(deps.library as object))

  app.get('/api/themes', (c) => c.json(themes))
  app.get('/api/themes/:id', (c) => {
    const theme = themes.find((t) => t.id === c.req.param('id'))
    return theme ? c.json(theme) : c.json({ error: 'theme not found' }, 404)
  })

  // Semantic validation oracle for the FE level editor / ad-hoc checks (BE-D3/D4).
  app.post('/api/validate', async (c) => {
    let body: { def?: GameDefinition }
    try {
      body = (await c.req.json()) as { def?: GameDefinition }
    } catch {
      return c.json({ error: 'invalid JSON body' }, 400)
    }
    if (!body?.def) return c.json({ error: 'missing `def`' }, 400)
    try {
      return c.json({ analyses: analyze(body.def) })
    } catch (e) {
      return c.json({ error: (e as Error).message }, 400)
    }
  })

  // Static tile/bg/shared PNGs. Path-traversal guarded (stays within assetRoot).
  app.get('/assets/*', (c) => {
    const rel = decodeURIComponent(c.req.path.slice('/assets/'.length))
    const file = resolve(assetBase, rel)
    if (file !== assetBase && !file.startsWith(assetBase + sep)) {
      return c.json({ error: 'forbidden path' }, 400)
    }
    if (!existsSync(file) || !statSync(file).isFile()) return c.json({ error: 'not found' }, 404)
    const ext = file.slice(file.lastIndexOf('.')).toLowerCase()
    const body = new Uint8Array(readFileSync(file))
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': CONTENT_TYPE[ext] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  })

  return app
}
