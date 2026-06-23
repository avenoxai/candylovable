import type { GameDefinition, ThemeTokens } from '@candylovable/contract'

/** Gems theme — resolved from assets/library.json (themes.gems), the shared asset seam. */
export const gemsTheme: ThemeTokens = {
  id: 'gems',
  displayName: 'Gems',
  assetBaseUrl: '/assets',
  background: 'themes/gems/bg_gems.png',
  backdropColor: 'oklch(0.18 0.03 300)',
  tiles: [
    { colorId: 0, file: 'themes/gems/tile_gems_00.png', description: 'faceted red ruby, octagon cut' },
    { colorId: 1, file: 'themes/gems/tile_gems_01.png', description: 'faceted blue sapphire, round cut' },
    { colorId: 2, file: 'themes/gems/tile_gems_02.png', description: 'faceted green emerald, square cut' },
    { colorId: 3, file: 'themes/gems/tile_gems_03.png', description: 'faceted yellow citrine, hexagon cut' },
    { colorId: 4, file: 'themes/gems/tile_gems_04.png', description: 'faceted purple amethyst, oval cut' },
    { colorId: 5, file: 'themes/gems/tile_gems_05.png', description: 'faceted orange fire-opal, teardrop cut' },
  ],
  // Per-colorId accent (for particles/glow). 6 distinct, readable hues.
  palette: [
    'oklch(0.72 0.19 25)', // red
    'oklch(0.72 0.15 230)', // blue
    'oklch(0.80 0.17 140)', // green
    'oklch(0.84 0.16 95)', // yellow
    'oklch(0.65 0.22 300)', // purple
    'oklch(0.74 0.18 55)', // orange
  ],
}

/** A small, ready-to-play match-3 used by the renderer and tests. */
export const sampleMatch3: GameDefinition = {
  schemaVersion: 1,
  id: 'sample-gems-match3',
  meta: { title: 'Gem Cascade', gameType: 'match3' },
  board: {
    width: 8,
    height: 8,
    cellTypes: [
      { colorId: 0, label: 'ruby' },
      { colorId: 1, label: 'topaz' },
      { colorId: 2, label: 'emerald' },
      { colorId: 3, label: 'sapphire' },
      { colorId: 4, label: 'amethyst' },
      { colorId: 5, label: 'aqua' },
    ],
  },
  rules: {
    minMatch: 3,
    allowDiagonal: false,
    specials: [
      { match: 'line4', creates: 'striped-h' },
      { match: 'line5', creates: 'colorBomb' },
      { match: 'tShape', creates: 'wrapped' },
      { match: 'lShape', creates: 'wrapped' },
    ],
    scoring: {
      baseClear: 60,
      cascadeMultiplier: 'linear',
      specialCreateBonus: { 'striped-h': 120, wrapped: 200, colorBomb: 200 },
    },
  },
  levels: [
    {
      index: 0,
      goal: { kind: 'score', target: 2000 },
      moveLimit: 20,
      stars: [2000, 4000, 6000],
    },
    {
      index: 1,
      goal: { kind: 'score', target: 5000 },
      moveLimit: 25,
      stars: [5000, 8000, 12000],
    },
  ],
  theme: gemsTheme,
  audio: {
    pack: 'default',
    cues: {
      swap: '/assets/audio/swap.wav',
      match: '/assets/audio/match.wav',
      cascade: '/assets/audio/cascade.wav',
      win: '/assets/audio/win.wav',
      lose: '/assets/audio/lose.wav',
    },
  },
  juice: {
    particles: 0.8,
    screenShake: 0.5,
    squashStretch: 0.7,
    cascadePitch: 0.9,
    reducedMotionFallback: true,
  },
}
