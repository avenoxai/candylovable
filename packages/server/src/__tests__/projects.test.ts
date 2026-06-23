import { beforeEach, describe, expect, it } from 'vitest'
import { sampleMatch3 } from '@candylovable/mocks'
import { createApp } from '../app'
import { MemoryStore } from '../store/memory'
import type { Clock, Project, Version } from '../store/store'

const clock = (): Clock => {
  let n = 0
  return { ids: () => `id-${++n}`, now: () => 1000 + n }
}

let store: MemoryStore
let app: ReturnType<typeof createApp>
let projectId: string

beforeEach(async () => {
  store = new MemoryStore(clock())
  app = createApp({ store, assetRoot: '/unused', library: { themes: {} } })
  const { project } = await store.createProject('Gem Cascade', sampleMatch3)
  projectId = project.id
  await store.addVersion(projectId, sampleMatch3, 'tweak goal') // v2
})

describe('GET /api/projects', () => {
  it('lists projects', async () => {
    const res = await app.request('/api/projects')
    expect(res.status).toBe(200)
    const list = (await res.json()) as Project[]
    expect(list).toHaveLength(1)
    expect(list[0]?.title).toBe('Gem Cascade')
    expect(list[0]?.currentVersion).toBe(2)
  })

  it('fetches one project + 404 for unknown', async () => {
    expect((await app.request(`/api/projects/${projectId}`)).status).toBe(200)
    expect((await app.request('/api/projects/nope')).status).toBe(404)
  })
})

describe('GET /api/projects/:id/versions', () => {
  it('lists versions', async () => {
    const res = await app.request(`/api/projects/${projectId}/versions`)
    const versions = (await res.json()) as Version[]
    expect(versions).toHaveLength(2)
    expect(versions[0]?.message).toBe('initial')
    expect(versions[1]?.message).toBe('tweak goal')
  })

  it('404s for an unknown project', async () => {
    expect((await app.request('/api/projects/nope/versions')).status).toBe(404)
  })

  it('fetches one version + 404 missing + 400 bad number', async () => {
    expect((await app.request(`/api/projects/${projectId}/versions/1`)).status).toBe(200)
    expect((await app.request(`/api/projects/${projectId}/versions/99`)).status).toBe(404)
    expect((await app.request(`/api/projects/${projectId}/versions/abc`)).status).toBe(400)
  })
})

describe('POST /api/projects/:id/restore/:n', () => {
  it('restores a version as a new current version (non-destructive)', async () => {
    const res = await app.request(`/api/projects/${projectId}/restore/1`, { method: 'POST' })
    expect(res.status).toBe(200)
    const project = (await res.json()) as Project
    expect(project.currentVersion).toBe(3)
    expect(await store.listVersions(projectId)).toHaveLength(3)
  })

  it('404s when restoring a missing version', async () => {
    expect((await app.request(`/api/projects/${projectId}/restore/99`, { method: 'POST' })).status).toBe(404)
  })
})
