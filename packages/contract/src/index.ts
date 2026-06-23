/**
 * @candylovable/contract — the SHARED boundary between the front-end (echo) and
 * the system/engine agent. See reports/frontend-plan.md §1.
 *
 * Touch this package only after logging the change in the worklog and versioning
 * the contract. The engine implements {@link EngineInstance}; the generation
 * pipeline emits {@link GenerationEvent}; the preview bridge speaks {@link Envelope}.
 */
export const CONTRACT_VERSION = 1 as const
export type ContractVersion = typeof CONTRACT_VERSION

export * from './coord'
export * from './game-definition'
export * from './engine'
export * from './generation'
export * from './bridge'
