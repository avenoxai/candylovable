import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { CONTRACT_VERSION, type GameDefinition } from '@candylovable/contract'
import { analyzeGame, analyzeLevel } from '@candylovable/engine'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AuthoringDeps, AuthoringPort, GenerateInput, IterateInput } from './authoring'
import { FakeAuthoring } from './fake-authoring'
import { resolveThemes } from './library'
import { streamGeneration } from './sse'
import type { Store } from './store/store'

export interface AppDeps {
  store: Store
  /** Filesystem path to the `assets/` dir. */
  assetRoot: string
  /** Parsed `library.json` (raw — served verbatim). */
  library: unknown
  /** Generation pipeline host; defaults to FakeAuthoring until @candylovable/authoring lands (BE-D10). */
  authoring?: AuthoringPort
  /** Defaults to the engine's analyzeGame; injectable for tests. */
  analyze?: typeof analyzeGame
  /** Edge providers (volatility lives here, not in core — BE-D6). */
  ids?: () => string
  now?: () => number
  rng?: () => number
  /** CORS allowed origin(s) for the FE↔BE seam. Defaults to '*' (dev); pass `false` to disable. */
  corsOrigins?: string | string[] | false
  /** Structured per-request log sink (also where authoring's cache-hit KPI surfaces). */
  logger?: (entry: RequestLog) => void
}

export interface RequestLog {
  method: string
  path: string
  status: number
  ms: number
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
  const authoring = deps.authoring ?? new FakeAuthoring()
  const ids = deps.ids ?? (() => randomUUID())
  const now = deps.now ?? (() => Date.now())
  const rng = deps.rng ?? Math.random
  const themes = resolveThemes(deps.library)
  const assetBase = resolve(deps.assetRoot)

  const authoringDeps = (signal: AbortSignal): AuthoringDeps => ({
    ids,
    now,
    rng,
    analyzeLevel,
    library: deps.library,
    signal,
  })

  // --- cross-cutting middleware (registered before routes) ---
  if (deps.corsOrigins !== false) app.use('*', cors({ origin: deps.corsOrigins ?? '*' }))
  const logger = deps.logger
  if (logger) {
    app.use('*', async (c, next) => {
      const start = now()
      await next()
      logger({ method: c.req.method, path: c.req.path, status: c.res.status, ms: now() - start })
    })
  }
  app.onError((err, c) => c.json({ error: err.message || 'internal error' }, 500))
  app.notFound((c) => c.json({ error: 'not found', path: c.req.path }, 404))

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

  // Generation: mount the authoring pipeline as an SSE stream. Opens a session, and on
  // `gameReady` persists the def as a new project (v1). The session id is returned in a
  // header so the FE can drive `/api/iterate`.
  app.post('/api/generate', async (c) => {
    let body: GenerateInput
    try {
      body = (await c.req.json()) as GenerateInput
    } catch {
      return c.json({ error: 'invalid JSON body' }, 400)
    }
    if (!body?.prompt || typeof body.prompt !== 'string') return c.json({ error: 'missing `prompt`' }, 400)

    const session = await deps.store.createSession()
    const gen = authoring.generate({ prompt: body.prompt }, authoringDeps(c.req.raw.signal))
    c.header('X-Session-Id', session.id)
    return streamGeneration(c, gen, async (e) => {
      if (e.type === 'gameReady') {
        await deps.store.setSessionDef(session.id, e.def)
        const { project } = await deps.store.createProject(e.def.meta.title, e.def)
        await deps.store.setSessionProject(session.id, project.id)
      }
    })
  })

  // Iteration: load the session, stream the targeted edit, and on `gameReady` append a
  // turn + a new project version (the version-history UI reads these).
  app.post('/api/iterate', async (c) => {
    let body: IterateInput
    try {
      body = (await c.req.json()) as IterateInput
    } catch {
      return c.json({ error: 'invalid JSON body' }, 400)
    }
    if (!body?.sessionId || !body?.message) return c.json({ error: 'missing `sessionId`/`message`' }, 400)
    const session = await deps.store.getSession(body.sessionId)
    if (!session) return c.json({ error: 'session not found' }, 404)

    const gen = authoring.iterate(
      { sessionId: body.sessionId, message: body.message, selection: body.selection },
      { ...authoringDeps(c.req.raw.signal), session },
    )
    return streamGeneration(c, gen, async (e) => {
      if (e.type === 'gameReady') {
        await deps.store.appendTurn(session.id, { message: body.message, def: e.def })
        if (session.projectId) await deps.store.addVersion(session.projectId, e.def, body.message)
      }
    })
  })

  // Projects + version history (the FE's undo / branch / publish surfaces read these).
  app.get('/api/projects', async (c) => c.json(await deps.store.listProjects()))

  app.get('/api/projects/:id', async (c) => {
    const project = await deps.store.getProject(c.req.param('id'))
    return project ? c.json(project) : c.json({ error: 'project not found' }, 404)
  })

  app.get('/api/projects/:id/versions', async (c) => {
    const id = c.req.param('id')
    if (!(await deps.store.getProject(id))) return c.json({ error: 'project not found' }, 404)
    return c.json(await deps.store.listVersions(id))
  })

  app.get('/api/projects/:id/versions/:n', async (c) => {
    const n = Number(c.req.param('n'))
    if (!Number.isInteger(n)) return c.json({ error: 'bad version number' }, 400)
    const version = await deps.store.getVersion(c.req.param('id'), n)
    return version ? c.json(version) : c.json({ error: 'version not found' }, 404)
  })

  // Non-destructive restore/branch: clone version n as a new current version.
  app.post('/api/projects/:id/restore/:n', async (c) => {
    const id = c.req.param('id')
    const n = Number(c.req.param('n'))
    if (!Number.isInteger(n)) return c.json({ error: 'bad version number' }, 400)
    if (!(await deps.store.getVersion(id, n))) return c.json({ error: 'version not found' }, 404)
    return c.json(await deps.store.restoreVersion(id, n))
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
