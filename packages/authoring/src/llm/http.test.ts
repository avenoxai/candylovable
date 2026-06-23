import { describe, expect, it } from 'vitest'
import { HttpDeepSeekClient } from './http'

function fakeFetch(payload: unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    const bodyText = typeof payload === 'string' ? payload : JSON.stringify(payload)
    return new Response(bodyText, { status })
  }) as unknown as typeof fetch
  return { impl, calls }
}

const client = (impl: typeof fetch) =>
  new HttpDeepSeekClient({ apiKey: 'sk-test', baseUrl: 'https://api.deepseek.com', fetchImpl: impl })

describe('HttpDeepSeekClient', () => {
  it('maps content, usage (cache hit/miss + reasoning), and finish reason', async () => {
    const { impl, calls } = fakeFetch({
      choices: [{ message: { content: 'pong', tool_calls: [] }, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        prompt_cache_hit_tokens: 8,
        prompt_cache_miss_tokens: 2,
        completion_tokens_details: { reasoning_tokens: 3 },
      },
    })
    const r = await client(impl).chat({ model: 'pro', messages: [{ role: 'user', content: 'ping' }] })
    expect(r.content).toBe('pong')
    expect(r.usage.cacheHitTokens).toBe(8)
    expect(r.usage.cacheMissTokens).toBe(2)
    expect(r.usage.reasoningTokens).toBe(3)
    expect(r.finishReason).toBe('stop')

    const call = calls[0]!
    expect(call.url).toContain('/chat/completions')
    expect((call.init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
    const body = JSON.parse(call.init.body as string)
    expect(body.model).toBe('deepseek-v4-pro')
    expect(body.stream).toBe(false)
  })

  it('parses tool-call arguments from the JSON string', async () => {
    const { impl } = fakeFetch({
      choices: [
        {
          message: { tool_calls: [{ id: 'c1', function: { name: 'select_theme', arguments: '{"theme":"candy"}' } }] },
          finish_reason: 'tool_calls',
        },
      ],
    })
    const r = await client(impl).chat({ model: 'flash', messages: [] })
    expect(r.toolCalls[0]).toEqual({ id: 'c1', name: 'select_theme', arguments: { theme: 'candy' } })
  })

  it('does not crash on malformed tool arguments (returns {})', async () => {
    const { impl } = fakeFetch({
      choices: [{ message: { tool_calls: [{ id: 'c1', function: { name: 'x', arguments: 'not json' } }] }, finish_reason: 'tool_calls' }],
    })
    const r = await client(impl).chat({ model: 'flash', messages: [] })
    expect(r.toolCalls[0]!.arguments).toEqual({})
  })

  it('attaches tools in the request body when provided', async () => {
    const { impl, calls } = fakeFetch({ choices: [{ message: { content: 'x' }, finish_reason: 'stop' }] })
    await client(impl).chat({
      model: 'flash',
      messages: [],
      tools: [{ name: 't', description: 'd', parameters: { type: 'object' } }],
    })
    const body = JSON.parse(calls[0]!.init.body as string)
    expect(body.tools[0]).toEqual({ type: 'function', function: { name: 't', description: 'd', parameters: { type: 'object' } } })
  })

  it('throws on a non-OK HTTP status', async () => {
    const { impl } = fakeFetch('unauthorized', 401)
    await expect(client(impl).chat({ model: 'flash', messages: [] })).rejects.toThrow(/HTTP 401/)
  })
})
