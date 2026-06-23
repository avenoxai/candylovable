/**
 * @candylovable/mocks — FE-side reference implementations the front-end builds and
 * tests against, so it is never blocked on the real engine / generation pipeline.
 *
 * - {@link FakeEngine}: a functional match-3 engine emitting real {@link EngineEvent}s.
 * - board primitives: generate / findMatches / gravity / refill / move-detection / shuffle.
 * - fixtures: a ready-to-play {@link GameDefinition} on the gems theme.
 */
export * from './board'
export * from './fake-engine'
export * from './fixtures'
export * from './generation'
export * from './msw'
