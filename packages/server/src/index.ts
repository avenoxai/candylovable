/**
 * @candylovable/server — the Node + Hono backend (BE-D2). Hosts deepseek-infra's
 * generate/iterate library as SSE (P5), serves the asset library + tiles, and exposes
 * project/version/session persistence + an ad-hoc `/api/validate` over the engine oracle.
 *
 * Plan: reports/backend-plan.md · decisions: reports/decisions-backend.md.
 * STATUS: P5 — generate/iterate SSE mounted on the AuthoringPort (FakeAuthoring stand-in,
 * BE-D10) with session/project/version persistence. Serving + Store from P4. Projects/
 * versions read+restore routes (P6) and real-authoring wiring (P8) next.
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
