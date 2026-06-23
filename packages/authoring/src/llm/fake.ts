import type { ChatRequest, ChatResult, DeepSeekClient } from './client'

/** One scripted reply. `match` (optional) asserts the request shape we expected. */
export interface ScriptedTurn {
  match?: (req: ChatRequest) => boolean
  result: ChatResult
}

/**
 * A deterministic, hermetic stand-in for the real client. Replays `script` turns in
 * order so the orchestrator can be tested end-to-end (e.g. against `ideal-trace.md`)
 * with zero network. Throws loudly on an unexpected or missing turn — a silent
 * mismatch would hide a wiring bug.
 */
export class FakeDeepSeek implements DeepSeekClient {
  private cursor = 0
  constructor(private readonly script: ScriptedTurn[]) {}

  async chat(req: ChatRequest): Promise<ChatResult> {
    const turn = this.script[this.cursor]
    if (!turn) throw new Error(`FakeDeepSeek: script exhausted at call ${this.cursor}`)
    this.cursor += 1
    if (turn.match && !turn.match(req)) {
      throw new Error(`FakeDeepSeek: unexpected request at step ${this.cursor - 1} (model=${req.model})`)
    }
    return turn.result
  }

  /** Number of scripted turns consumed so far — handy for assertions. */
  get calls(): number {
    return this.cursor
  }
}
