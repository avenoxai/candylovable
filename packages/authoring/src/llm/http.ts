import { MODEL_SLUG } from '../config'
import type { ChatRequest, ChatResult, DeepSeekClient, ToolCall, Usage } from './client'
import { emptyUsage } from './client'

export interface HttpDeepSeekOptions {
  apiKey: string
  baseUrl: string
  /** Inject a fetch for hermetic tests; defaults to the global (node 22+). */
  fetchImpl?: typeof fetch
}

/** Minimal shape of the DeepSeek `/chat/completions` response we read. */
interface DeepSeekResponse {
  choices?: Array<{
    message?: { content?: string | null; tool_calls?: RawToolCall[] }
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    prompt_cache_hit_tokens?: number
    prompt_cache_miss_tokens?: number
    completion_tokens_details?: { reasoning_tokens?: number }
  }
}
interface RawToolCall {
  id?: string
  function?: { name?: string; arguments?: string }
}

/**
 * The real client. One non-streaming `chat()` per call (token-stream UX is FE's job —
 * PRD §11). Maps DeepSeek's response + usage (incl. cache hit/miss) into our `ChatResult`
 * so the cost model + tiering harness can measure every call.
 */
export class HttpDeepSeekClient implements DeepSeekClient {
  constructor(private readonly opts: HttpDeepSeekOptions) {}

  async chat(req: ChatRequest): Promise<ChatResult> {
    const doFetch = this.opts.fetchImpl ?? fetch
    const body: Record<string, unknown> = {
      model: MODEL_SLUG[req.model],
      messages: req.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
      })),
      stream: false,
    }
    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }))
    }
    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens
    // NOTE: DeepSeek v4 thinking-toggle param is unconfirmed (PRD §12 / O3). Until verified
    // we rely on max_tokens to bound reasoning; req.thinking is intentionally not sent yet.

    const res = await doFetch(`${this.opts.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      throw new Error(`DeepSeek HTTP ${res.status}: ${await res.text()}`)
    }
    return mapResult((await res.json()) as DeepSeekResponse)
  }
}

function mapResult(json: DeepSeekResponse): ChatResult {
  const choice = json.choices?.[0]
  if (!choice?.message) throw new Error('DeepSeek: response had no choices/message')
  return {
    content: choice.message.content ?? '',
    toolCalls: mapToolCalls(choice.message.tool_calls),
    usage: mapUsage(json.usage),
    finishReason: choice.finish_reason ?? 'unknown',
  }
}

function mapToolCalls(raw: RawToolCall[] | undefined): ToolCall[] {
  if (!raw) return []
  return raw.map((tc, i) => ({
    id: tc.id ?? `call_${i}`,
    name: tc.function?.name ?? '',
    arguments: parseArgs(tc.function?.arguments),
  }))
}

function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function mapUsage(u: DeepSeekResponse['usage']): Usage {
  if (!u) return emptyUsage()
  return {
    promptTokens: u.prompt_tokens ?? 0,
    cacheHitTokens: u.prompt_cache_hit_tokens ?? 0,
    cacheMissTokens: u.prompt_cache_miss_tokens ?? 0,
    completionTokens: u.completion_tokens ?? 0,
    reasoningTokens: u.completion_tokens_details?.reasoning_tokens ?? 0,
  }
}
