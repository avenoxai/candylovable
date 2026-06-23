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
  let k = 0
  const app = createApp({
    store,
    assetRoot: '/unused',
    library: { themes: {} },
    ids: () => `gen-${++k}`,
    now: () => 7,
    rng: () => 0.5,
  })
  return { store, app }
}

const generate = async (app: ReturnType<typeof createApp>): Promise<string> => {
  const res = await app.request('/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'a base game' }),
  })
  await res.text() // drain so persistence completes
  return res.headers.get('x-session-id') as string
}

const iterate = (app: ReturnType<typeof createApp>, body: unknown) =>
  app.request('/api/iterate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/iterate', () => {
  it('applies an edit, appends a turn, and adds a project version', async () => {
    const { store, app } = buildApp()
    const sessionId = await generate(app)
    const baseTarget = (await store.getSession(sessionId))?.currentDef?.levels[0]?.goal.target

    const res = await iterate(app, { sessionId, message: 'make level 1 harder' })
    expect(res.status).toBe(200)
    const events = parseSSE(await res.text())
    const ready = events.find((e) => e.type === 'gameReady')
    expect(ready?.type).toBe('gameReady')
    if (ready?.type === 'gameReady') {
      expect(ready.def.levels[0]?.goal.target).toBe((baseTarget as number) + 500)
    }

    const session = await store.getSession(sessionId)
    expect(session?.history).toHaveLength(1)
    expect(session?.history[0]?.message).toBe('make level 1 harder')

    const versions = await store.listVersions(session?.projectId as string)
    expect(versions).toHaveLength(2) // v1 from generate + v2 from iterate
    expect(versions[1]?.message).toBe('make level 1 harder')
  })

  it('404s for an unknown session and 400s on missing fields', async () => {
    const { app } = buildApp()
    expect((await iterate(app, { sessionId: 'nope', message: 'hi' })).status).toBe(404)
    expect((await iterate(app, { message: 'hi' })).status).toBe(400)
    expect((await iterate(app, { sessionId: 'x' })).status).toBe(400)
  })
})
