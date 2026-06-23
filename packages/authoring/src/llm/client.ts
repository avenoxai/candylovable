/**
 * The DeepSeek client boundary. The orchestrator talks ONLY to this interface, so
 * tests inject {@link FakeDeepSeek} and never touch the network. The real
 * {@link HttpDeepSeekClient} (flash/pro, streaming) lands in P1.
 */

/** The two model tiers (slugs resolved in config.ts). */
export type ModelTier = 'flash' | 'pro'

/** A tool the model may call. `parameters` is a JSON Schema (stable key order — P1). */
export interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/** A tool invocation the model emitted. */
export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** Set on `role:'tool'` messages to correlate with the originating call. */
  toolCallId?: string
  /** Set on `role:'assistant'` messages that called tools (required before tool results). */
  toolCalls?: ToolCall[]
}

/** Token accounting from one model call. `cacheHit/Miss` drive the cost model (rules.md §7). */
export interface Usage {
  promptTokens: number
  cacheHitTokens: number
  cacheMissTokens: number
  completionTokens: number
  reasoningTokens: number
}

export const emptyUsage = (): Usage => ({
  promptTokens: 0,
  cacheHitTokens: 0,
  cacheMissTokens: 0,
  completionTokens: 0,
  reasoningTokens: 0,
})

export interface ChatRequest {
  model: ModelTier
  messages: ChatMessage[]
  tools?: ToolDef[]
  maxTokens?: number
  /** DeepSeek v4 thinks by default; set false for flash routing where supported (PRD §6, O3). */
  thinking?: boolean
}

export interface ChatResult {
  content: string
  toolCalls: ToolCall[]
  usage: Usage
  finishReason: string
}

/** The model boundary. One non-streaming call in P0; streaming arrives in P1. */
export interface DeepSeekClient {
  chat(req: ChatRequest): Promise<ChatResult>
}
