import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { sampleMatch3 } from '@candylovable/mocks'
import { JsonFileStore } from '../store/json-file'
import { MemoryStore } from '../store/memory'
import type { Clock, Store } from '../store/store'

/** Deterministic edge clock: sequential ids + a monotonic counter "now". */
const fakeClock = (): Clock => {
  let n = 0
  let t = 1_000
  return { ids: () => `id-${++n}`, now: () => ++t }
}

const runStoreContract = (name: string, make: () => Store): void => {
  describe(`Store contract — ${name}`, () => {
    it('creates + reads + mutates a session', async () => {
      const store = make()
      const s = await store.createSession()
      expect(s.id).toBeTruthy()
      expect(s.history).toEqual([])
      await store.setSessionDef(s.id, sampleMatch3)
      await store.appendTurn(s.id, { message: 'make it harder', def: sampleMatch3 })
      const loaded = await store.getSession(s.id)
      expect(loaded?.currentDef?.id).toBe(sampleMatch3.id)
      expect(loaded?.history).toHaveLength(1)
      expect(loaded?.history[0]?.message).toBe('make it harder')
    })

    it('returns null for a missing session + throws on mutating one', async () => {
      const store = make()
      expect(await store.getSession('nope')).toBeNull()
      await expect(store.setSessionDef('nope', sampleMatch3)).rejects.toThrow()
    })

    it('creates a project with version 1 and lists it', async () => {
      const store = make()
      const { project, version } = await store.createProject('My Game', sampleMatch3)
      expect(project.currentVersion).toBe(1)
      expect(version.n).toBe(1)
      expect(await store.listProjects()).toHaveLength(1)
      expect((await store.getProject(project.id))?.title).toBe('My Game')
    })

    it('adds versions monotonically and tracks currentVersion', async () => {
      const store = make()
      const { project } = await store.createProject('G', sampleMatch3)
      const v2 = await store.addVersion(project.id, sampleMatch3, 'tweak goal')
      expect(v2.n).toBe(2)
      expect((await store.getProject(project.id))?.currentVersion).toBe(2)
      expect(await store.listVersions(project.id)).toHaveLength(2)
      expect((await store.getVersion(project.id, 1))?.message).toBe('initial')
    })

    it('restores a version as a NEW current version (non-destructive branch)', async () => {
      const store = make()
      const { project } = await store.createProject('G', sampleMatch3)
      await store.addVersion(project.id, sampleMatch3, 'v2')
      const restored = await store.restoreVersion(project.id, 1)
      expect(restored.currentVersion).toBe(3) // v1, v2, then restored copy as v3
      const versions = await store.listVersions(project.id)
      expect(versions).toHaveLength(3)
      expect(versions[2]?.message).toContain('restore of v1')
    })

    it('does not leak internal state (reads are clones)', async () => {
      const store = make()
      const { project } = await store.createProject('G', sampleMatch3)
      const a = await store.getProject(project.id)
      if (a) a.title = 'mutated'
      expect((await store.getProject(project.id))?.title).toBe('G')
    })
  })
}

runStoreContract('MemoryStore', () => new MemoryStore(fakeClock()))

const tmpDirs: string[] = []
runStoreContract('JsonFileStore', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cl-store-'))
  tmpDirs.push(dir)
  return new JsonFileStore(join(dir, 'store.json'), fakeClock())
})

describe('JsonFileStore persistence', () => {
  it('reloads saved data from disk into a fresh instance', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cl-store-'))
    tmpDirs.push(dir)
    const file = join(dir, 'store.json')
    const a = new JsonFileStore(file, fakeClock())
    const { project } = await a.createProject('Persisted', sampleMatch3)
    const b = new JsonFileStore(file, fakeClock())
    expect((await b.getProject(project.id))?.title).toBe('Persisted')
    expect(await b.listProjects()).toHaveLength(1)
  })
})

afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true })
})
