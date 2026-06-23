import type { ModelTier } from '../llm/client'

/**
 * One row of per-step observability — the data that turns "flash or pro?" from a guess
 * into a measurement (PRD §5). The file-backed JSONL writer + run dirs land in P1; P0
 * defines the shape + an in-memory sink the tests and harness use.
 */
export interface StepRecord {
  runId: string
  stepIndex: number
  stepName: string
  tool?: string
  model: ModelTier
  thinking: boolean
  promptTokens: number
  cacheHitTokens: number
  cacheMissTokens: number
  completionTokens: number
  reasoningTokens: number
  costUSD: number
  latencyMs: number
  toolCallOk: boolean
  validationPassed?: boolean
  notes?: string
}

export interface StepLogger {
  log(rec: StepRecord): void
  records(): readonly StepRecord[]
  totalCostUSD(): number
}

/** Collects records in memory. P1 adds a JSONL writer to loop/deepseek-infra/runs/<runId>/. */
export class MemoryStepLogger implements StepLogger {
  private readonly recs: StepRecord[] = []

  log(rec: StepRecord): void {
    this.recs.push(rec)
  }

  records(): readonly StepRecord[] {
    return this.recs
  }

  totalCostUSD(): number {
    return this.recs.reduce((sum, r) => sum + r.costUSD, 0)
  }
}
