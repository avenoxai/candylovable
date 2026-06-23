import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AssetTile, ThemeTokens } from '@candylovable/contract'

/** Read `library.json` from the asset root (raw, verbatim — served as-is by /api/library). */
export const loadLibraryRaw = (assetRoot: string): unknown => {
  const file = join(assetRoot, 'library.json')
  if (!existsSync(file)) throw new Error(`library.json not found at ${file}`)
  return JSON.parse(readFileSync(file, 'utf8'))
}

/**
 * A theme's background path, parsed DEFENSIVELY: the catalog has drifted from a bare
 * string to a `{file, description}` object (assets-for-deepseek-infra handoff), so accept
 * either. Backend never reshapes the catalog — it just resolves what's live.
 */
const backgroundPath = (bg: unknown): string => {
  if (typeof bg === 'string') return bg
  if (bg && typeof bg === 'object' && 'file' in bg) return String((bg as { file: unknown }).file)
  return ''
}

const titleCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Resolve a {@link ThemeTokens} per theme entry in the catalog. Tolerant of the evolving
 * shape (background string|object, missing tiles). `palette` is renderer-owned → left empty.
 */
export const resolveThemes = (raw: unknown, assetBaseUrl = '/assets'): ThemeTokens[] => {
  const themes = (raw as { themes?: Record<string, unknown> } | null)?.themes ?? {}
  const out: ThemeTokens[] = []
  for (const [id, entryU] of Object.entries(themes)) {
    const entry = entryU as { background?: unknown; tiles?: AssetTile[] }
    out.push({
      id,
      displayName: titleCase(id),
      assetBaseUrl,
      background: backgroundPath(entry.background),
      tiles: Array.isArray(entry.tiles) ? entry.tiles : [],
      palette: [],
    })
  }
  return out
}
