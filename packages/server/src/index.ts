/**
 * @candylovable/server — the Node + Hono backend (BE-D2). Hosts deepseek-infra's
 * generate/iterate library as SSE (P5), serves the asset library + tiles, and exposes
 * project/version/session persistence + an ad-hoc `/api/validate` over the engine oracle.
 *
 * Plan: reports/backend-plan.md · decisions: reports/decisions-backend.md.
 * STATUS: P6 + P8-hardening — serving + generate/iterate SSE + projects/versions, plus
 * CORS / request logging / error handler / graceful SSE error. GATED: real
 * @candylovable/authoring wiring (its API is still moving) and P7 runtime blockers
 * (CONTRACT_VERSION 2). FakeAuthoring stays mounted until the adapter lands.
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
