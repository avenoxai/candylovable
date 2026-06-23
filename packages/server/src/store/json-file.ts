import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Clock, Project, Session, Version } from './store'
import { MemoryStore } from './memory'

interface Snapshot {
  sessions: [string, Session][]
  projects: [string, Project][]
  versions: [string, Version[]][]
}

/**
 * File-backed {@link Store} for dev durability — loads a JSON snapshot on construction
 * and rewrites it after every mutation. Lives under a git-ignored data dir. A real DB
 * store can replace this behind the same interface (BE-O2) with no route change.
 */
export class JsonFileStore extends MemoryStore {
  constructor(
    private readonly file: string,
    clock: Clock,
  ) {
    super(clock)
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, 'utf8')) as Snapshot
      this.sessions = new Map(data.sessions)
      this.projects = new Map(data.projects)
      this.versions = new Map(data.versions)
    }
  }

  protected override persist(): void {
    const snapshot: Snapshot = {
      sessions: [...this.sessions],
      projects: [...this.projects],
      versions: [...this.versions],
    }
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify(snapshot))
  }
}
