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
  'code — you emit data via tools. Hard rules: exactly 6 tiles (colorId 0-5); difficulty ' +
  'OSCILLATES (easy → hard → breather → climax), never a monotonic ramp; vary the goal kinds; ' +
  'introduce at most one new element per level; for a score goal the 1-star threshold equals ' +
  'the goal target; tune juice (do not max it) and always keep reducedMotionFallback true. ' +
  'When the game is complete and valid, call finalize.'

/** Build the frozen per-model prefixes. Stable inputs → stable prefix (the cache invariant). */
export function buildPrefixes(opts: { assetSkill: string; digest: string; tools: ToolDef[] }): {
  flash: FrozenPrefix
  pro: FrozenPrefix
} {
  const context = `\n\n## Asset library — how to use it\n${opts.assetSkill}\n\n## Catalog\n${opts.digest}`
  return {
    flash: { system: BASE_FLASH + context, tools: opts.tools },
    pro: { system: BASE_PRO + context, tools: opts.tools },
  }
}
