import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sampleMatch3 } from '@candylovable/mocks'
import { createApp } from '../app'
import { loadLibraryRaw } from '../library'
import { MemoryStore } from '../store/memory'
import type { Clock } from '../store/store'

const clock: Clock = { ids: () => 'fixed-id', now: () => 42 }

// A fixture catalog exercising BOTH background shapes (object + legacy string).
const LIBRARY = {
  version: 1,
  tile_size: 256,
  kind: 'whole_sprite',
  themes: {
    candy: {
      background: { file: 'themes/candy/bg_candy.png', description: 'pastel candyland' },
      tiles: [{ colorId: 0, file: 'themes/candy/tile_candy_00.png', description: 'red heart' }],
    },
    legacy: {
      background: 'themes/legacy/bg_legacy.png', // legacy bare-string form
      tiles: [],
    },
  },
  shared: { overlay: [], blocker: [], texture_9slice: [], particle: [] },
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

let assetRoot: string
let app: ReturnType<typeof createApp>

beforeAll(() => {
  assetRoot = mkdtempSync(join(tmpdir(), 'cl-assets-'))
  writeFileSync(join(assetRoot, 'library.json'), JSON.stringify(LIBRARY))
  mkdirSync(join(assetRoot, 'themes', 'candy'), { recursive: true })
  writeFileSync(join(assetRoot, 'themes', 'candy', 'tile_candy_00.png'), PNG_BYTES)
  app = createApp({ store: new MemoryStore(clock), assetRoot, library: loadLibraryRaw(assetRoot) })
})

afterAll(() => rmSync(assetRoot, { recursive: true, force: true }))

describe('GET /api/health', () => {
  it('reports ok + the contract version', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, contractVersion: 1 })
  })
})

describe('GET /api/library', () => {
  it('serves the catalog verbatim', async () => {
    const res = await app.request('/api/library')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(LIBRARY)
  })
})

describe('GET /api/themes', () => {
  it('resolves themes, parsing background defensively (object AND string)', async () => {
    const res = await app.request('/api/themes')
    const themes = (await res.json()) as { id: string; background: string; tiles: unknown[] }[]
    expect(themes.map((t) => t.id).sort()).toEqual(['candy', 'legacy'])
    const candy = themes.find((t) => t.id === 'candy')
    const legacy = themes.find((t) => t.id === 'legacy')
    expect(candy?.background).toBe('themes/candy/bg_candy.png') // from {file}
    expect(legacy?.background).toBe('themes/legacy/bg_legacy.png') // from bare string
    expect(candy?.tiles).toHaveLength(1)
  })

  it('returns one theme by id, 404 for unknown', async () => {
    expect((await app.request('/api/themes/candy')).status).toBe(200)
    expect((await app.request('/api/themes/nope')).status).toBe(404)
  })
})

describe('POST /api/validate', () => {
  it('analyses every level of a valid def', async () => {
    const res = await app.request('/api/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ def: sampleMatch3 }),
    })
    expect(res.status).toBe(200)
    const { analyses } = (await res.json()) as { analyses: unknown[] }
    expect(analyses).toHaveLength(sampleMatch3.levels.length)
  })

  it('400s on a missing def and on invalid JSON', async () => {
    const missing = await app.request('/api/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(missing.status).toBe(400)
    const bad = await app.request('/api/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    })
    expect(bad.status).toBe(400)
  })
})

describe('GET /assets/*', () => {
  it('serves a tile PNG with the right content-type + bytes', async () => {
    const res = await app.request('/assets/themes/candy/tile_candy_00.png')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toContain('max-age')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG_BYTES)
  })

  it('404s on a missing asset', async () => {
    expect((await app.request('/assets/themes/candy/missing.png')).status).toBe(404)
  })

  it('never serves a file outside the asset root (traversal blocked)', async () => {
    // Blocked either by URL/router normalization (404) or the handler guard (400) —
    // the security property is that it is NOT served and leaks nothing.
    const res = await app.request('/assets/%2e%2e/%2e%2e/package.json')
    expect([400, 404]).toContain(res.status)
    expect(res.status).not.toBe(200)
  })
})
