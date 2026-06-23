import type { GameDefinition } from './game-definition'

/** One of the 2–3 art/mechanic directions offered before a full build. */
export interface DesignDirection {
  id: string
  title: string
  summary: string
  themeId: string
  previewColors: string[]
}

export interface SelectionContext {
  entityId: string
  kind: string
  label?: string
}

export interface GenerateRequest {
  prompt: string
}

export interface IterateRequest {
  sessionId: string
  message: string
  selection?: SelectionContext
}

/**
 * Server-sent events streamed by the generation pipeline (system agent).
 * Consumed FE-side via fetch + ReadableStream (never EventSource — needs auth headers).
 */
export type GenerationEvent =
  | { type: 'plan'; steps: string[] }
  | {
      type: 'step'
      id: string
      label: string
      status: 'start' | 'done'
      kind: 'design' | 'rules' | 'level' | 'theme' | 'asset'
    }
  | { type: 'token'; text: string }
  | { type: 'partial'; def: Partial<GameDefinition> }
  | { type: 'designDirections'; options: DesignDirection[] }
  | { type: 'gameReady'; def: GameDefinition }
  | { type: 'error'; message: string; recoverable: boolean }
  | { type: 'done' }

export type GenerationEventType = GenerationEvent['type']
