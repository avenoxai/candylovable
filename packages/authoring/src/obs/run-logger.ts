import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { StepLogger, StepRecord } from './logger'

/**
 * File-backed step logger: one JSON line per model call under `<runsDir>/<runId>/steps.jsonl`.
 * Side-effecting (fs + a caller-supplied runId), so it lives at the edge — the orchestrator
 * core stays pure and takes a {@link StepLogger}. Default runsDir = `loop/deepseek-infra/runs`.
 */
export class JsonlStepLogger implements StepLogger {
  private readonly recs: StepRecord[] = []
  private readonly file: string

  constructor(runsDir: string, runId: string) {
    const dir = join(runsDir, runId)
    mkdirSync(dir, { recursive: true })
    this.file = join(dir, 'steps.jsonl')
  }

  log(rec: StepRecord): void {
    this.recs.push(rec)
    appendFileSync(this.file, `${JSON.stringify(rec)}\n`)
  }

  records(): readonly StepRecord[] {
    return this.recs
  }

  totalCostUSD(): number {
    return this.recs.reduce((sum, r) => sum + r.costUSD, 0)
  }
}
