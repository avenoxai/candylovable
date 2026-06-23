import { describe, expect, it } from 'vitest'
import type { ChatResult } from './client'
import { emptyUsage } from './client'
import { FakeDeepSeek } from './fake'

const reply = (content: string): ChatResult => ({
  content,
  toolCalls: [],
  usage: emptyUsage(),
  finishReason: 'stop',
})

describe('FakeDeepSeek', () => {
  it('replays scripted turns in order', async () => {
    const fake = new FakeDeepSeek([{ result: reply('one') }, { result: reply('two') }])
    expect((await fake.chat({ model: 'flash', messages: [] })).content).toBe('one')
    expect((await fake.chat({ model: 'pro', messages: [] })).content).toBe('two')
    expect(fake.calls).toBe(2)
  })

  it('throws when the script is exhausted (no silent empty reply)', async () => {
    const fake = new FakeDeepSeek([])
    await expect(fake.chat({ model: 'flash', messages: [] })).rejects.toThrow(/exhausted/)
  })

  it('enforces a request matcher so a wiring bug surfaces loudly', async () => {
    const fake = new FakeDeepSeek([{ match: (r) => r.model === 'pro', result: reply('x') }])
    await expect(fake.chat({ model: 'flash', messages: [] })).rejects.toThrow(/unexpected request/)
  })
})
