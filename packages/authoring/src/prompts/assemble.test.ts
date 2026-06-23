import { describe, expect, it } from 'vitest'
import type { ToolDef } from '../llm/client'
import { type FrozenPrefix, assembleRequest, prefixHash } from './assemble'

const toolA: ToolDef = { name: 'a', description: 'da', parameters: { type: 'object', properties: {} } }
const toolB: ToolDef = { name: 'b', description: 'db', parameters: { type: 'object', properties: {} } }
const prefix: FrozenPrefix = { system: 'SYSTEM PROMPT (frozen)', tools: [toolA, toolB] }

describe('assembleRequest', () => {
  it('puts the frozen system first, then the dynamic tail, tools attached', () => {
    const req = assembleRequest('pro', prefix, { messages: [{ role: 'user', content: 'make a game' }] }, { maxTokens: 4000 })
    expect(req.messages[0]).toEqual({ role: 'system', content: 'SYSTEM PROMPT (frozen)' })
    expect(req.messages[1]).toEqual({ role: 'user', content: 'make a game' })
    expect(req.tools).toHaveLength(2)
    expect(req.maxTokens).toBe(4000)
  })
})

describe('prefixHash — the cache-invariant guard', () => {
  it('is stable for the same frozen prefix', () => {
    expect(prefixHash(prefix)).toBe(prefixHash({ system: prefix.system, tools: [toolA, toolB] }))
  })

  it('is independent of key order WITHIN a tool (canonical JSON)', () => {
    const reordered = { parameters: { properties: {}, type: 'object' }, description: 'da', name: 'a' } as ToolDef
    expect(prefixHash({ system: prefix.system, tools: [reordered, toolB] })).toBe(prefixHash(prefix))
  })

  it('CHANGES when tools are reordered (reordering busts the real cache)', () => {
    expect(prefixHash({ system: prefix.system, tools: [toolB, toolA] })).not.toBe(prefixHash(prefix))
  })

  it('CHANGES when anything volatile leaks into system (e.g. a timestamp)', () => {
    expect(prefixHash({ system: `${prefix.system} 2026-06-24T01:00:00Z`, tools: prefix.tools })).not.toBe(prefixHash(prefix))
  })
})
