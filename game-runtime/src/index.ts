/**
 * @candylovable/game-runtime — the FE game renderer + juice layer (Phase 4).
 * The pure cores live here (layout math, EngineEvent→juice mapping); the Pixi
 * renderer that plays the directives is added alongside (browser-only, covered
 * by Playwright). See reports/frontend-plan.md §6.
 */
export * from './layout'
export * from './juice'
export * from './scene'
export * from './board-controller'
