import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadCatalogFromFile } from '../assets/catalog'
import { loadConfig } from '../config'
import { scoreGame } from '../eval/bench'
import { HttpDeepSeekClient } from '../llm/http'
import { MemoryStepLogger } from '../obs/logger'
import { buildPrefixes, compactDigest } from '../prompts/system'
import { buildToolRegistry } from '../tools/tools'
import { generateToCompletion } from './generate'

/**
 * The DoD test: real DeepSeek (pro) drives the full pipeline from the benchmark prompt and
 * the output must score >= 80 on the rubric. GATED behind DEEPSEEK_LIVE=1 (never in CI).
 * Run: `DEEPSEEK_LIVE=1 pnpm exec vitest run packages/authoring/src/orchestrator/live-generate.test.ts`
 */
const LIVE = Boolean(process.env.DEEPSEEK_LIVE)

describe.runIf(LIVE)('generate — LIVE (real DeepSeek, the DoD)', () => {
  it(
    'produces a benchmark-grade game from the benchmark prompt',
    async () => {
      const cfg = loadConfig()
      const catalog = loadCatalogFromFile('assets/library.json')
      const assetSkill = readFileSync('assets/asset-skill.md', 'utf8')
      const { defs } = buildToolRegistry()
      const { pro } = buildPrefixes({ assetSkill, digest: compactDigest(catalog), tools: defs })
      const client = new HttpDeepSeekClient({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl })
      const logger = new MemoryStepLogger()
      const toolLog: string[] = []

      const prompt = 'make me a simple candy crush style match-3 game — a few levels, should feel juicy'
      const { def, events } = await generateToCompletion(prompt, {
        client,
        proPrefix: pro,
        catalog,
        logger,
        clock: () => Date.now(),
        maxRounds: 36,
        onTool: (name, ok, errors) => toolLog.push(ok ? name : `${name}!FAIL(${(errors ?? []).slice(0, 2).join(' | ')})`),
      })

      // eslint-disable-next-line no-console
      console.log('[live] tools:', toolLog.join(' → '))
      // eslint-disable-next-line no-console
      console.log('[live] events:', events.map((e) => e.type).filter((t) => t !== 'partial' && t !== 'step').join(','))
      // eslint-disable-next-line no-console
      console.log('[live] rounds:', logger.records().length, 'totalCost$:', logger.totalCostUSD().toFixed(5))
      if (def) {
        const card = scoreGame(def, { catalog })
        // eslint-disable-next-line no-console
        console.log('[live] score:', card.score, JSON.stringify(card.dimensions.map((d) => `${d.name}:${d.score}/${d.max}`)))
      }

      expect(def, 'pipeline produced a gameReady def').toBeDefined()
      expect(scoreGame(def!, { catalog }).score).toBeGreaterThanOrEqual(80)
    },
    280_000,
  )
})
