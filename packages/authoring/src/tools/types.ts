import type { GameDefinition } from '@candylovable/contract'
import type { AssetCatalog } from '../assets/catalog'
import type { ToolDef } from '../llm/client'
import type { EngineFactory } from '../validate/simulate-level'

/** The GameDefinition being assembled across tool calls. */
export interface DraftState {
  def: Partial<GameDefinition>
}

export const newDraft = (): DraftState => ({ def: {} })

export interface ToolContext {
  draft: DraftState
  catalog?: AssetCatalog
  makeEngine?: EngineFactory
}

/** Structured, already-validated result — never free-form prose the model must re-parse. */
export type ToolResult = { ok: true; data?: unknown } | { ok: false; errors: string[] }

export interface Tool {
  /** Which tier we expect to call this (hypothesis; measured in P5). */
  tier: 'flash' | 'pro' | 'system'
  def: ToolDef
  handler: (args: Record<string, unknown>, ctx: ToolContext) => ToolResult
}

export const ok = (data?: unknown): ToolResult => ({ ok: true, data })
export const fail = (...errors: string[]): ToolResult => ({ ok: false, errors })

// ---- small typed arg readers (the model sends loosely-typed JSON) ----
export const asString = (a: Record<string, unknown>, k: string): string | undefined =>
  typeof a[k] === 'string' ? (a[k] as string) : undefined
export const asNumber = (a: Record<string, unknown>, k: string): number | undefined =>
  typeof a[k] === 'number' ? (a[k] as number) : undefined
export const asArray = (a: Record<string, unknown>, k: string): unknown[] | undefined =>
  Array.isArray(a[k]) ? (a[k] as unknown[]) : undefined
export const asObject = (a: Record<string, unknown>, k: string): Record<string, unknown> | undefined =>
  a[k] !== null && typeof a[k] === 'object' && !Array.isArray(a[k]) ? (a[k] as Record<string, unknown>) : undefined
