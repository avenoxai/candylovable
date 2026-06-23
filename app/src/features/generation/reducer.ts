import type { DesignDirection, GameDefinition, GenerationEvent } from '@candylovable/contract'

export type GenerationStatus = 'idle' | 'streaming' | 'done' | 'error' | 'cancelled'

export interface TimelineStep {
  id: string
  label: string
  kind: 'design' | 'rules' | 'level' | 'theme' | 'asset'
  done: boolean
}

export interface GenerationState {
  status: GenerationStatus
  steps: TimelineStep[]
  text: string
  directions: DesignDirection[]
  partialTitle?: string
  def?: GameDefinition
  error?: string
}

export const initialGenerationState: GenerationState = {
  status: 'idle',
  steps: [],
  text: '',
  directions: [],
}

/** Pure fold of a GenerationEvent into UI state — the brain of the streaming UI. */
export const reduceGeneration = (state: GenerationState, e: GenerationEvent): GenerationState => {
  switch (e.type) {
    case 'plan':
      return state // plan is advisory; steps materialise from step events
    case 'step': {
      const idx = state.steps.findIndex((s) => s.id === e.id)
      const step: TimelineStep = { id: e.id, label: e.label, kind: e.kind, done: e.status === 'done' }
      const steps = idx >= 0 ? state.steps.map((s, i) => (i === idx ? step : s)) : [...state.steps, step]
      return { ...state, steps }
    }
    case 'token':
      return { ...state, text: state.text + e.text }
    case 'partial':
      return e.def.meta?.title ? { ...state, partialTitle: e.def.meta.title } : state
    case 'designDirections':
      return { ...state, directions: e.options }
    case 'gameReady':
      return { ...state, def: e.def }
    case 'error':
      return { ...state, status: 'error', error: e.message }
    case 'done':
      return state.status === 'error' ? state : { ...state, status: 'done' }
    default:
      return state
  }
}
