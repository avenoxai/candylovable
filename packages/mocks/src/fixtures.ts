import type { GameDefinition, ThemeManifest, ThemeTokens } from '@candylovable/contract'

/** Gems theme — mirrors assets/themes/gems/tile_gems.manifest.json (6 tiles, colorId 0-5). */
export const gemsManifest: ThemeManifest = {
  source: '_sheet.png',
  prefix: 'tile_gems',
  key: 'magenta',
  size: 256,
  count: 6,
  assets: [
    { file: 'tile_gems_00.png', index: 0, colorId: 0, bbox: [344, 87, 848, 588] },
    { file: 'tile_gems_01.png', index: 1, colorId: 1, bbox: [1194, 85, 1710, 601] },
    { file: 'tile_gems_02.png', index: 2, colorId: 2, bbox: [361, 766, 826, 1223] },
    { file: 'tile_gems_03.png', index: 3, colorId: 3, bbox: [1174, 764, 1712, 1242] },
    { file: 'tile_gems_04.png', index: 4, colorId: 4, bbox: [395, 1390, 786, 1944] },
    { file: 'tile_gems_05.png', index: 5, colorId: 5, bbox: [1248, 1354, 1644, 1957] },
  ],
}

export const gemsTheme: ThemeTokens = {
  id: 'gems',
  displayName: 'Gems',
  tileset: gemsManifest,
  assetBaseUrl: '/assets/themes/gems',
  background: 'oklch(0.18 0.03 300)',
  // Per-colorId accent (for particles/glow). 6 distinct, readable hues.
  palette: [
    'oklch(0.72 0.19 25)', // red
    'oklch(0.78 0.16 85)', // amber
    'oklch(0.80 0.17 140)', // green
    'oklch(0.72 0.15 230)', // blue
    'oklch(0.65 0.22 300)', // purple
    'oklch(0.85 0.13 200)', // cyan
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
