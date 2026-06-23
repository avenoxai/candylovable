import type { GameDefinition, JuiceConfig, ThemeTokens } from './game-definition'
import type { EngineEvent, GameState } from './engine'

export const BRIDGE_VERSION = 1 as const
export type BridgeVersion = typeof BRIDGE_VERSION

export type BridgeSource = 'builder-host' | 'game-runtime'

/** Versioned postMessage envelope across the builder ↔ preview-iframe boundary. */
export interface Envelope<T = unknown> {
  source: BridgeSource
  type: string
  version: BridgeVersion
  payload: T
  /** Correlates a request with its response. */
  requestId?: string
  ts: number
}

export type PreviewMode = 'play' | 'edit'

/** Parent (builder) → iframe (game runtime). */
export type HostMessage =
  | { type: 'BOOT'; payload: { runtimeUrl?: string } }
  | { type: 'LOAD_DEF'; payload: { def: GameDefinition; levelIndex: number } }
  | { type: 'SET_THEME'; payload: { theme: ThemeTokens } }
  | { type: 'SET_JUICE'; payload: { config: JuiceConfig } }
  | { type: 'PAUSE'; payload: Record<string, never> }
  | { type: 'RESUME'; payload: Record<string, never> }
  | { type: 'RESET'; payload: Record<string, never> }
  | { type: 'SET_MODE'; payload: { mode: PreviewMode } }
  | { type: 'HIGHLIGHT_ENTITY'; payload: { entityId: string } }

export type HostMessageType = HostMessage['type']

/** iframe (game runtime) → parent (builder). */
export type RuntimeMessage =
  | { type: 'READY'; payload: Record<string, never> }
  | { type: 'STATE'; payload: { state: GameState } }
  | { type: 'EVENT'; payload: { event: EngineEvent } }
  | { type: 'ENTITY_PICKED'; payload: { entityId: string; kind: string } }
  | { type: 'SCORE'; payload: { total: number } }
  | { type: 'LEVEL_COMPLETE'; payload: { stars: number } }
  | { type: 'ERROR'; payload: { message: string } }

export type RuntimeMessageType = RuntimeMessage['type']
