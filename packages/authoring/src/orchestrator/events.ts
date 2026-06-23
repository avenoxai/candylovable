import type { DesignDirection, GameDefinition, GenerationEvent } from '@candylovable/contract'

/**
 * Typed constructors for the contract's {@link GenerationEvent} union. The orchestrator
 * (P3) streams these; centralising them here keeps every emit byte-shaped to the contract
 * and gives the SSE round-trip tests a single source of truth.
 */
export const ev = {
  plan: (steps: string[]): GenerationEvent => ({ type: 'plan', steps }),
  step: (
    id: string,
    label: string,
    status: 'start' | 'done',
    kind: 'design' | 'rules' | 'level' | 'theme' | 'asset',
  ): GenerationEvent => ({ type: 'step', id, label, status, kind }),
  token: (text: string): GenerationEvent => ({ type: 'token', text }),
  partial: (def: Partial<GameDefinition>): GenerationEvent => ({ type: 'partial', def }),
  designDirections: (options: DesignDirection[]): GenerationEvent => ({ type: 'designDirections', options }),
  gameReady: (def: GameDefinition): GenerationEvent => ({ type: 'gameReady', def }),
  error: (message: string, recoverable: boolean): GenerationEvent => ({ type: 'error', message, recoverable }),
  done: (): GenerationEvent => ({ type: 'done' }),
} as const
