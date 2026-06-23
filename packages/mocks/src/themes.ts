import type { ThemeTokens } from '@candylovable/contract'

/** The six themes in assets/library.json. */
export const THEME_IDS = ['candy', 'gems', 'fruit', 'ocean', 'farm', 'emoji'] as const
export type ThemeId = (typeof THEME_IDS)[number]

/** Six readable accent hues (per-colorId) for particles/glow. */
const BASE_PALETTE = [
  'oklch(0.72 0.19 25)', // red
  'oklch(0.72 0.15 230)', // blue
  'oklch(0.8 0.17 140)', // green
  'oklch(0.84 0.16 95)', // yellow
  'oklch(0.65 0.22 300)', // purple
  'oklch(0.74 0.18 55)', // orange
]

const BACKDROPS: Record<ThemeId, string> = {
  candy: 'oklch(0.22 0.04 350)',
  gems: 'oklch(0.18 0.03 300)',
  fruit: 'oklch(0.2 0.03 140)',
  ocean: 'oklch(0.2 0.04 230)',
  farm: 'oklch(0.22 0.03 110)',
  emoji: 'oklch(0.2 0.03 60)',
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Resolve a {@link ThemeTokens} for any catalog theme from the hard asset-naming
 * contract (`themes/<id>/tile_<id>_NN.png`, `bg_<id>.png`). Lets the author
 * switch themes without a network round-trip (frontend-first).
 */
export const resolveTheme = (id: ThemeId): ThemeTokens => ({
  id,
  displayName: cap(id),
  assetBaseUrl: '/assets',
  background: `themes/${id}/bg_${id}.png`,
  backdropColor: BACKDROPS[id],
  tiles: Array.from({ length: 6 }, (_, i) => ({
    colorId: i,
    file: `themes/${id}/tile_${id}_0${i}.png`,
  })),
  palette: BASE_PALETTE,
})
