import type { GameDefinition } from '@candylovable/contract'
import type { Clock, Project, Session, Store, Version } from './store'

const clone = <T>(v: T): T => structuredClone(v)

/**
 * In-memory {@link Store} — the default for tests and ephemeral dev. All reads return
 * clones so callers can't mutate internal state. {@link JsonFileStore} extends this and
 * overrides {@link persist} to durably write after each mutation.
 */
export class MemoryStore implements Store {
  protected sessions = new Map<string, Session>()
  protected projects = new Map<string, Project>()
  protected versions = new Map<string, Version[]>()

  constructor(protected clock: Clock) {}

  /** Called after every mutation. No-op in memory; JsonFileStore writes to disk. */
  protected persist(): void {}

  async createSession(): Promise<Session> {
    const session: Session = { id: this.clock.ids(), createdAt: this.clock.now(), history: [] }
    this.sessions.set(session.id, session)
    this.persist()
    return clone(session)
  }

  async getSession(id: string): Promise<Session | null> {
    const s = this.sessions.get(id)
    return s ? clone(s) : null
  }

  async setSessionDef(id: string, def: GameDefinition): Promise<void> {
    const s = this.sessions.get(id)
    if (!s) throw new Error(`session ${id} not found`)
    s.currentDef = clone(def)
    this.persist()
  }

  async setSessionProject(id: string, projectId: string): Promise<void> {
    const s = this.sessions.get(id)
    if (!s) throw new Error(`session ${id} not found`)
    s.projectId = projectId
    this.persist()
  }

  async appendTurn(id: string, turn: { message: string; def: GameDefinition }): Promise<void> {
    const s = this.sessions.get(id)
    if (!s) throw new Error(`session ${id} not found`)
    s.history.push({ message: turn.message, def: clone(turn.def), at: this.clock.now() })
    s.currentDef = clone(turn.def)
    this.persist()
  }

  async createProject(
    title: string,
    def: GameDefinition,
    message = 'initial',
  ): Promise<{ project: Project; version: Version }> {
    const id = this.clock.ids()
    const now = this.clock.now()
    const project: Project = { id, title, createdAt: now, updatedAt: now, currentVersion: 1 }
    const version: Version = { projectId: id, n: 1, def: clone(def), message, createdAt: now }
    this.projects.set(id, project)
    this.versions.set(id, [version])
    this.persist()
    return { project: clone(project), version: clone(version) }
  }

  async getProject(id: string): Promise<Project | null> {
    const p = this.projects.get(id)
    return p ? clone(p) : null
  }

  async listProjects(): Promise<Project[]> {
    return [...this.projects.values()].map(clone)
  }

  async addVersion(projectId: string, def: GameDefinition, message: string): Promise<Version> {
    const project = this.projects.get(projectId)
    const list = this.versions.get(projectId)
    if (!project || !list) throw new Error(`project ${projectId} not found`)
    const version: Version = {
      projectId,
      n: list.length + 1,
      def: clone(def),
      message,
      createdAt: this.clock.now(),
    }
    list.push(version)
    project.currentVersion = version.n
    project.updatedAt = version.createdAt
    this.persist()
    return clone(version)
  }

  async listVersions(projectId: string): Promise<Version[]> {
    return (this.versions.get(projectId) ?? []).map(clone)
  }

  async getVersion(projectId: string, n: number): Promise<Version | null> {
    const v = (this.versions.get(projectId) ?? []).find((x) => x.n === n)
    return v ? clone(v) : null
  }

  async restoreVersion(projectId: string, n: number): Promise<Project> {
    const target = (this.versions.get(projectId) ?? []).find((x) => x.n === n)
    if (!target) throw new Error(`version ${n} of project ${projectId} not found`)
    await this.addVersion(projectId, target.def, `restore of v${n}`)
    return clone(this.projects.get(projectId) as Project)
  }
}
