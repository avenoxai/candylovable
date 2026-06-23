import { describe, expect, it } from 'vitest'
import type { GenerationEvent } from '@candylovable/contract'
import { createApp, type RequestLog } from '../app'
import type { AuthoringPort } from '../authoring'
import { MemoryStore } from '../store/memory'
import type { Clock } from '../store/store'
import { parseSSE } from '../sse'

const clock: Clock = { ids: () => 'id', now: () => 0 }
const baseDeps = () => ({ store: new MemoryStore(clock), assetRoot: '/unused', library: { themes: {} } })

describe('CORS', () => {
  it('allows the FE origin by default', async () => {
    const app = createApp(baseDeps())
    const res = await app.request('/api/health', { headers: { Origin: 'http://localhost:5173' } })
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('echoes a configured origin', async () => {
    const app = createApp({ ...baseDeps(), corsOrigins: 'http://localhost:5173' })
    const res = await app.request('/api/health', { headers: { Origin: 'http://localhost:5173' } })
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })
})

describe('request logging', () => {
  it('invokes the logger with method/path/status/ms', async () => {
    const logs: RequestLog[] = []
    let t = 0
    const app = createApp({ ...baseDeps(), logger: (e) => logs.push(e), now: () => (t += 5) })
    await app.request('/api/health')
    const entry = logs.find((l) => l.path === '/api/health')
    expect(entry).toBeDefined()
    expect(entry?.method).toBe('GET')
    expect(entry?.status).toBe(200)
    expect(entry?.ms).toBeGreaterThanOrEqual(0)
  })
})

describe('notFound', () => {
  it('returns a JSON 404 for an unknown route', async () => {
    const app = createApp(baseDeps())
    const res = await app.request('/api/nope')
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'not found' })
  })
})

describe('graceful SSE error', () => {
  const throwingAuthoring: AuthoringPort = {
    async *generate() {
      yield { type: 'plan', steps: ['x'] } as GenerationEvent
      throw new Error('boom')
    },
    // eslint-disable-next-line require-yield
    async *iterate() {
      throw new Error('nope')
    },
  }

  it('emits a contract error event and persists nothing when the pipeline throws', async () => {
    const store = new MemoryStore(clock)
    const app = createApp({ store, assetRoot: '/unused', library: { themes: {} }, authoring: throwingAuthoring })
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'x' }),
    })
    expect(res.status).toBe(200)
    const events = parseSSE(await res.text())
    const err = events.find((e) => e.type === 'error')
    expect(err).toMatchObject({ type: 'error', message: 'boom', recoverable: false })
    expect(events.find((e) => e.type === 'gameReady')).toBeUndefined()
    expect(await store.listProjects()).toHaveLength(0)
  })
})
