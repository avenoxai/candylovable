import type { ModelTier } from './llm/client'

/** Tier → DeepSeek model slug. Locked; legacy `deepseek-chat`/`-reasoner` deprecate 2026-07-24. */
export const MODEL_SLUG: Record<ModelTier, string> = {
  flash: 'deepseek-v4-flash',
  pro: 'deepseek-v4-pro',
}

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

export interface AuthoringConfig {
  /** From `DEEPSEEK_API_KEY` (.env, sourced from keychain). Never logged. */
  apiKey: string
  baseUrl: string
  /** Max pro repair attempts after a failed validation (PRD §3, §12). */
  repairBudget: number
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AuthoringConfig {
  return {
    apiKey: env.DEEPSEEK_API_KEY ?? '',
    baseUrl: env.DEEPSEEK_BASE_URL ?? DEEPSEEK_BASE_URL,
    repairBudget: 3,
  }
}
