import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadCatalogFromFile } from '../assets/catalog'
import { loadConfig } from '../config'
import { scoreGame } from '../eval/bench'
import type { ModelTier } from '../llm/client'
import { HttpDeepSeekClient } from '../llm/http'
import { MemoryStepLogger } from '../obs/logger'
import type { FrozenPrefix } from '../prompts/assemble'
import { buildPrefixes, compactDigest } from '../prompts/system'
import { buildToolRegistry } from '../tools/tools'
import { generateToCompletion } from './generate'

/**
 * Flash-vs-pro A/B on the same benchmark prompt: is flash good enough to switch to
 * (cheaper + faster)? Logs score/cost/latency/rounds side by side. GATED behind
 * DEEPSEEK_LIVE=1 (never in CI).
 * Run: `DEEPSEEK_LIVE=1 pnpm exec vitest run packages/authoring/src/orchestrator/live-flash-vs-pro.test.ts`
 */
const LIVE = Boolean(process.env.DEEPSEEK_LIVE)

describe.runIf(LIVE)('generate — LIVE flash vs pro A/B', () => {
  it(
    'runs the benchmark prompt on both tiers and reports score/cost/latency',
    async () => {
      const cfg = loadConfig()
      const catalog = loadCatalogFromFile('assets/library.json')
      const assetSkill = readFileSync('assets/asset-skill.md', 'utf8')
      const { defs } = buildToolRegistry()
      const { flash, pro } = buildPrefixes({ assetSkill, digest: compactDigest(catalog), tools: defs })
      const client = new HttpDeepSeekClient({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl })

      const prompt =
        'make me a fruit match-3 — 5 levels. mix score-target levels with collect-the-recipe ' +
        'levels (collect bananas, then blueberries). difficulty should oscillate ' +
        'easy → hard → breather → big finale. should feel juicy.'

      const run = async (tier: ModelTier, prefix: FrozenPrefix) => {
        const logger = new MemoryStepLogger()
        const toolLog: string[] = []
        const t0 = Date.now()
        const { def } = await generateToCompletion(prompt, {
          client,
          proPrefix: pro,
          tier,
          prefix,
          catalog,
          logger,
          clock: () => Date.now(),
          maxRounds: 36,
          onTool: (name, ok, errors) =>
            toolLog.push(ok ? name : `${name}!FAIL(${(errors ?? []).slice(0, 1).join('')})`),
        })
        const ms = Date.now() - t0
        const card = def ? scoreGame(def, { catalog }) : undefined
        return { tier, def, ms, rounds: logger.records().length, costUSD: logger.totalCostUSD(), card, toolLog }
      }

      // Sequential (not parallel) so each tier's prefix cache stays warm and we don't race rate limits.
      const flashR = await run('flash', flash)
      const proR = await run('pro', pro)

      for (const r of [flashR, proR]) {
        // eslint-disable-next-line no-console
        console.log(
          `\n[${r.tier}] score=${r.card?.score ?? 'N/A'}/100  cost=$${r.costUSD.toFixed(5)}  ` +
            `rounds=${r.rounds}  ${(r.ms / 1000).toFixed(1)}s  finalized=${Boolean(r.def)}`,
        )
        if (r.card) {
          // eslint-disable-next-line no-console
          console.log(`     dims: ${r.card.dimensions.map((d) => `${d.name} ${d.score}/${d.max}`).join(' · ')}`)
        }
        // eslint-disable-next-line no-console
        console.log(`     tools: ${r.toolLog.join(' → ')}`)
      }

      // eslint-disable-next-line no-console
      console.log(
        `\n[A/B] flash ${flashR.card?.score ?? 0}/100 @ $${flashR.costUSD.toFixed(5)} (${(flashR.ms / 1000).toFixed(1)}s)  ` +
          `vs pro ${proR.card?.score ?? 0}/100 @ $${proR.costUSD.toFixed(5)} (${(proR.ms / 1000).toFixed(1)}s)\n`,
      )

      expect(flashR.def, 'flash produced a def').toBeDefined()
      expect(proR.def, 'pro produced a def').toBeDefined()
    },
    560_000,
  )
})
