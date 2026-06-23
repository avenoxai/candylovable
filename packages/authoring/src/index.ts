/**
 * @candylovable/authoring — the deepseek-infra authoring layer (INDEX lane #4).
 *
 * Turns a prompt into a benchmark-grade {@link GameDefinition} via DeepSeek (flash/pro)
 * orchestrated with tools. Shipped as a LIBRARY (`generate()/iterate()` land in P3/P4);
 * backend hosts the HTTP routes. Built phase-by-phase per `loop/deepseek-infra/PRD.md`.
 */
export * from './config'
export * from './llm/client'
export * from './llm/fake'
export * from './llm/http'
export * from './llm/serialize'
export * from './prompts/assemble'
export * from './assets/catalog'
export * from './validate/validate-game'
export * from './validate/simulate-level'
export * from './tools/types'
export * from './tools/finalize'
export * from './tools/tools'
export * from './obs/cost'
export * from './obs/logger'
export * from './obs/run-logger'
export * from './orchestrator/events'
export * from './eval/load'
