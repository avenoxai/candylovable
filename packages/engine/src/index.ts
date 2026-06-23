/**
 * @candylovable/engine — the headless match-3 core (backend, INDEX lane #2).
 *
 * Two consumers:
 *  1. the FE renderer drives an {@link EngineInstance} and turns its semantic
 *     {@link EngineEvent}s into juice (the FE/BE boundary);
 *  2. deepseek-infra's validate→repair gate calls the simulation API
 *     (`simulate_level`) for solvability + deterministic star derivation
 *     (decisions-echo ECHO-D8).
 *
 * Full plan + phases: reports/backend-plan.md · decisions: reports/decisions-backend.md.
 * STATUS: P1 in progress — board primitives + RNG landed; Engine class + sim API next.
 */

export * from './rng'
export * from './board'
