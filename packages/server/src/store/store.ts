import type { GameDefinition } from '@candylovable/contract'

/** One iterate turn appended to a session's history. */
export interface IterateTurn {
  message: string
  def: GameDefinition
  at: number
}

/** A live authoring session — the working def + its iterate history (feeds `/api/iterate`). */
export interface Session {
  id: string
  createdAt: number
  currentDef?: GameDefinition
  history: IterateTurn[]
}

/** A saved project (the unit the FE lists + version-controls). */
export interface Project {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  currentVersion: number
}

/** An immutable snapshot of a project's def at a point in time. */
export interface Version {
  projectId: string
  n: number
  def: GameDefinition
  message: string
  createdAt: number
}

/** Edge-supplied id + clock (volatility lives at the server edge, never in core — BE-D6). */
export interface Clock {
  ids: () => string
  now: () => number
}

/**
 * Persistence for sessions, projects, and versions. The serving layer depends on this
 * interface only; `MemoryStore` (tests/ephemeral) and `JsonFileStore` (dev) implement it,
 * and a DB-backed store can later slot in behind the same shape (BE-O2).
 */
export interface Store {
  createSession(): Promise<Session>
  getSession(id: string): Promise<Session | null>
  setSessionDef(id: string, def: GameDefinition): Promise<void>
  appendTurn(id: string, turn: { message: string; def: GameDefinition }): Promise<void>

  createProject(
    title: string,
    def: GameDefinition,
    message?: string,
  ): Promise<{ project: Project; version: Version }>
  getProject(id: string): Promise<Project | null>
  listProjects(): Promise<Project[]>
  addVersion(projectId: string, def: GameDefinition, message: string): Promise<Version>
  listVersions(projectId: string): Promise<Version[]>
  getVersion(projectId: string, n: number): Promise<Version | null>
  /** Non-destructive undo/branch: clone version `n` as a new current version. */
  restoreVersion(projectId: string, n: number): Promise<Project>
}
