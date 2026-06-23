/**
 * @candylovable/server — the Node + Hono backend (BE-D2). Hosts deepseek-infra's
 * generate/iterate library as SSE (P5), serves the asset library + tiles, and exposes
 * project/version/session persistence + an ad-hoc `/api/validate` over the engine oracle.
 *
 * Plan: reports/backend-plan.md · decisions: reports/decisions-backend.md.
 * STATUS: P6 — serving + generate/iterate SSE + projects/versions read+restore, all on
 * MemoryStore/JsonFileStore. Real @candylovable/authoring wiring (P8) is the remaining
 * gated step; P7 (runtime blockers) waits on CONTRACT_VERSION 2.
 */
export * from './app'
export * from './authoring'
export * from './fake-authoring'
export * from './sse'
export * from './config'
export * from './library'
export * from './store/store'
export * from './store/memory'
export * from './store/json-file'
