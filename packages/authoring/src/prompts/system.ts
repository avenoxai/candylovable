import type { AssetCatalog, SharedKind } from '../assets/catalog'
import type { ToolDef } from '../llm/client'
import type { FrozenPrefix } from './assemble'

/**
 * A compact, byte-stable digest of the library for the frozen prefix — names + descriptions
 * only (what the model needs to *select*), not file paths/bbox. Sorted deterministically so
 * the prefix hash stays stable (rules.md §7).
 */
export function compactDigest(catalog: AssetCatalog): string {
  const themes = catalog
    .themeIds()
    .sort()
    .map((id) => {
      const t = catalog.getTheme(id)
      const tiles = (t?.tiles ?? [])
        .slice()
        .sort((a, b) => a.colorId - b.colorId)
        .map((x) => `${x.colorId}:${x.description ?? x.file}`)
        .join('; ')
      return `- ${id} — ${tiles}`
    })
    .join('\n')
  const kinds: SharedKind[] = ['overlay', 'blocker', 'texture_9slice', 'particle']
  const shared = kinds.map((k) => `- ${k}: ${catalog.shared(k).map((a) => a.name).join(', ')}`).join('\n')
  return `THEMES (pick exactly ONE; entries are colorId:description):\n${themes}\n\nSHARED ASSETS (reference by exact name):\n${shared}`
}

const BASE_FLASH =
  'You are a fast router for a match-3 authoring system. You classify intent and make small ' +
  'structured choices — selecting a theme/asset, routing an edit. Be terse. Always act through ' +
  'tools; never invent asset names or file paths.'

const BASE_PRO =
  'You are an expert match-3 game designer. You compose a complete, valid, FUN game by calling ' +
  'tools: select ONE theme, set rules, and author a level curve. You never draw art or write ' +
  'code — you emit data via tools, and you NEVER reply in prose, only tool calls.\n\n' +
  'Required order (you may batch several tool calls in one turn):\n' +
  '1. select_theme  2. set_meta  3. set_board (8x8 is good)  4. set_rules\n' +
  '5. author_level ×5 — a VARIED, OSCILLATING curve (easy → harder → breather → climax), not a ' +
  'monotonic ramp; mix goal kinds — use ONLY these: {GOALS}; introduce at most one new ' +
  'element per level.  6. set_juice (tuned, not maxed).  7. finalize.\n\n' +
  'Hard rules: exactly 6 tiles (colorId 0-5); for a score goal the 1-star threshold EQUALS the ' +
  'goal target; stars strictly increasing; reducedMotionFallback always true.\n' +
  'Always finish by calling finalize. If finalize (or validate_game) returns errors, fix EXACTLY ' +
  'those and call finalize again. Do not stop until finalize succeeds.'

/**
 * Build the frozen per-model prefixes. Stable inputs → stable prefix (the cache invariant).
 * `goalKinds` constrains which goals the model may use — defaults to the full set; backend
 * v1 integration passes `['score','collect']` (clearJelly/bringDown need CONTRACT_VERSION 2).
 */
export function buildPrefixes(opts: {
  assetSkill: string
  digest: string
  tools: ToolDef[]
  goalKinds?: readonly string[]
}): { flash: FrozenPrefix; pro: FrozenPrefix } {
  const goals = (opts.goalKinds ?? ['score', 'collect', 'clearJelly']).join(', ')
  const context = `\n\n## Asset library — how to use it\n${opts.assetSkill}\n\n## Catalog\n${opts.digest}`
  return {
    flash: { system: BASE_FLASH + context, tools: opts.tools },
    pro: { system: BASE_PRO.replace('{GOALS}', goals) + context, tools: opts.tools },
  }
}
