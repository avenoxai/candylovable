import { describe, expect, it } from 'vitest'
import { createApp } from '../app'
import { MemoryStore } from '../store/memory'
import type { Clock } from '../store/store'
import { parseSSE } from '../sse'

const clock = (): Clock => {
  let n = 0
  return { ids: () => `id-${++n}`, now: () => 100 + n }
}

const buildApp = () => {
  const store = new MemoryStore(clock())
  const app = createApp({
    store,
    assetRoot: '/unused',
    library: { themes: {} },
    ids: (() => {
      let k = 0
      return () => `gen-${++k}`
    })(),
    now: () => 7,
    rng: () => 0.5,
  })
  return { store, app }
}

const post = (app: ReturnType<typeof createApp>, body: unknown, init: RequestInit = {}) =>
  app.request('/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  })

describe('POST /api/generate', () => {
  it('streams plan → designDirections → gameReady → done and persists a project', async () => {
    const { store, app } = buildApp()
    const res = await post(app, { prompt: 'a candy game' })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const sessionId = res.headers.get('x-session-id')
    expect(sessionId).toBeTruthy()

    const events = parseSSE(await res.text())
    const types = events.map((e) => e.type)
    expect(types[0]).toBe('plan')
    expect(types).toContain('designDirections')
    expect(types).toContain('gameReady')
    expect(types[types.length - 1]).toBe('done')

    const ready = events.find((e) => e.type === 'gameReady')
    expect(ready && ready.type === 'gameReady' && ready.def.meta.title).toBe('a candy game')

    // persistence side-effects ran during the stream
    const projects = await store.listProjects()
    expect(projects).toHaveLength(1)
    expect(projects[0]?.title).toBe('a candy game')
    const session = await store.getSession(sessionId as string)
    expect(session?.currentDef).toBeDefined()
    expect(session?.projectId).toBe(projects[0]?.id)
  })

  it('400s on a missing prompt and invalid JSON', async () => {
    const { app } = buildApp()
    expect((await post(app, {})).status).toBe(400)
    const bad = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    })
    expect(bad.status).toBe(400)
  })

  it('an aborted request yields no gameReady and persists nothing', async () => {
    const { store, app } = buildApp()
    const ctrl = new AbortController()
    ctrl.abort()
    const res = await post(app, { prompt: 'x' }, { signal: ctrl.signal })
    // stream ends without producing a game
    const events = parseSSE(await res.text().catch(() => ''))
    expect(events.find((e) => e.type === 'gameReady')).toBeUndefined()
    expect(await store.listProjects()).toHaveLength(0)
  })
})
